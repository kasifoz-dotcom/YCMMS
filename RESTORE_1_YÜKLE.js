import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const formatCurrentDateTr = () => new Date().toLocaleDateString('tr-TR');

const formatCurrentTime5Min = () => {
  const now = new Date();
  const roundedMinutes = Math.floor(now.getMinutes() / 5) * 5;
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = roundedMinutes.toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [işletmeId, setİşletmeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [musteriNo, setMusteriNo] = useState('');
  const musteriNoRef = useRef('');

  // Üretim form states
  const [tarihBaslangic, setTarihBaslangic] = useState(formatCurrentDateTr());
  const [saatBaslangic, setSaatBaslangic] = useState(formatCurrentTime5Min());
  const [selectedMakine, setSelectedMakine] = useState('');
  const [siparisNo, setSiparisNo] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [showDatePickerBas, setShowDatePickerBas] = useState(false);
  const uretimScrollRef = useRef(null);
  const bakimDetailScrollRef = useRef(null);

  // Bakım states
  const [selectedAriza, setSelectedAriza] = useState(null);
  const [arizalar, setArizalar] = useState([]);
  const [activeArizaCount, setActiveArizaCount] = useState(0);
  const [bakimVardiya, setBakimVardiya] = useState('');
  const [bakimTeknisyen, setBakimTeknisyen] = useState('');
  const [bakimNeden, setBakimNeden] = useState('');
  const [bakimAciklama, setBakimAciklama] = useState('');
  const [mudahaleBaslangic, setMudahaleBaslangic] = useState(formatCurrentTime5Min());
  const [bakimTarihBitis, setBakimTarihBitis] = useState(formatCurrentDateTr());
  const [bakimSaatBitis, setBakimSaatBitis] = useState(formatCurrentTime5Min());
  const [showDatePickerBit, setShowDatePickerBit] = useState(false);

  // Ayarlar
  const [isimler, setIsimler] = useState([]);
  const [vardiyalar, setVardiyalar] = useState([]);
  const [makineler, setMakineler] = useState([]);
  const [nedenler, setNedenler] = useState([]);
  const [ayarlarDocId, setAyarlarDocId] = useState(null);

  // Veri Girişi states
  const [yeniMakine, setYeniMakine] = useState('');
  const [yeniIsim, setYeniIsim] = useState('');
  const [yeniVardiya, setYeniVardiya] = useState('');
  const [yeniNeden, setYeniNeden] = useState('');

  // Hesap Menüsü
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    // Bakım Detail sayfasında otomatik güncellemeyi devre dışı bırak
    if (currentScreen === 'bakimDetail') {
      return; // Hiçbir şey yapma, saatleri sabitle
    }

    const syncStartDateTime = () => {
      setTarihBaslangic(formatCurrentDateTr());
      setSaatBaslangic(formatCurrentTime5Min());
      setMudahaleBaslangic(formatCurrentTime5Min());
      setBakimTarihBitis(formatCurrentDateTr());
      setBakimSaatBitis(formatCurrentTime5Min());
    };

    syncStartDateTime();
    const timer = setInterval(syncStartDateTime, 60000);

    return () => clearInterval(timer);
  }, [currentScreen]);

  useEffect(() => {
    musteriNoRef.current = musteriNo.trim();
  }, [musteriNo]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setCurrentScreen('menu');
        const userDoc = await getDocs(query(collection(db, 'kullanicilar'), where('email', '==', currentUser.email)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          const isletmeIdDetermined = userData.işletme_id || userData.isletme_id || currentUser.email;
          const girilenMusteriNo = musteriNoRef.current;

          if (girilenMusteriNo && girilenMusteriNo !== isletmeIdDetermined) {
            Alert.alert('Hata', 'Bu kullanici girilen Musteri No ile eslesmiyor.');
            await signOut(auth);
            setLoading(false);
            return;
          }

          console.log('[DEBUG] User login:', {user_email: currentUser.email, userData: userData, isletmeIdDetermined: isletmeIdDetermined});
          setUserRole(userData.rol || '');
          setİşletmeId(isletmeIdDetermined);
          await ayarlariYukle(isletmeIdDetermined);
          await arizalariYukle(isletmeIdDetermined);
        } else {
          if (musteriNoRef.current) {
            Alert.alert('Hata', 'Kullanici kaydi bulunamadi. Lutfen yonetici ile iletisime gecin.');
            await signOut(auth);
            setLoading(false);
            return;
          }

          // Kullanıcı dokümanı bulunamadı, email'i işletmeId olarak kullan
          console.warn('[DEBUG] Kullanıcı dokümanı bulunamadı, email fallback kullanılıyor:', currentUser.email);
          setİşletmeId(currentUser.email);
          await ayarlariYukle(currentUser.email);
          await arizalariYukle(currentUser.email);
        }
      } else {
        setUser(null);
        setCurrentScreen('menu');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ayarlariYukle = async (işletmeIdParam) => {
    try {
      console.log('Ayarlar yükleniyor, işletme_id:', işletmeIdParam);
      const ayarDoc = await getDocs(query(collection(db, 'ayarlar'), where('işletme_id', '==', işletmeIdParam)));
      if (!ayarDoc.empty) {
        const ayarData = ayarDoc.docs[0].data();
        const docId = ayarDoc.docs[0].id;
        setAyarlarDocId(docId);
        console.log('Ayarlar bulundu, docId:', docId);
        setIsimler(ayarData.isimler || []);
        setVardiyalar(ayarData.vardiyalar || []);
        setMakineler(ayarData.makineler || []);
        setNedenler(ayarData.nedenler || []);
      } else {
        // Ayarlar yoksa oluştur
        console.log('Ayarlar bulunamadı, yeni oluşturuluyor');
        const newAyarDoc = await addDoc(collection(db, 'ayarlar'), {
          işletme_id: işletmeIdParam,
          makineler: [],
          isimler: [],
          vardiyalar: [],
          nedenler: []
        });
        setAyarlarDocId(newAyarDoc.id);
        console.log('Yeni ayarlar oluşturuldu, docId:', newAyarDoc.id);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
  };

  const ayarlariKaydet = async () => {
    try {
      console.log('Ayarlar kaydediliyor, ayarlarDocId:', ayarlarDocId, 'işletmeId:', işletmeId);
      if (!ayarlarDocId) {
        // Eğer document yoksa yeni oluştur
        console.log('DocId yok, yeni oluşturuluyor');
        const newDoc = await addDoc(collection(db, 'ayarlar'), {
          işletme_id: işletmeId,
          makineler,
          isimler,
          vardiyalar,
          nedenler
        });
        setAyarlarDocId(newDoc.id);
        console.log('Yeni document oluşturuldu:', newDoc.id);
        Alert.alert('Başarılı', 'Ayarlar kaydedildi (yeni document)');
      } else {
        // Var olan document'ı güncelle
        console.log('Mevcut document güncelleniyor');
        await updateDoc(doc(db, 'ayarlar', ayarlarDocId), {
          makineler,
          isimler,
          vardiyalar,
          nedenler
        });
        console.log('Document başarıyla güncellendi');
        Alert.alert('Başarılı', 'Ayarlar güncellendi');
      }
    } catch (error) {
      console.error('Kaydedilme hatası:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilemedi: ' + error.message);
    }
  };

  const makineEkle = () => {
    if (!yeniMakine.trim()) return;
    setMakineler([...makineler, yeniMakine.trim()]);
    setYeniMakine('');
  };

  const makineSil = (index) => {
    setMakineler(makineler.filter((_, i) => i !== index));
  };

  const isimEkle = () => {
    if (!yeniIsim.trim()) return;
    setIsimler([...isimler, yeniIsim.trim()]);
    setYeniIsim('');
  };

  const isimSil = (index) => {
    setIsimler(isimler.filter((_, i) => i !== index));
  };

  const vardiyaEkle = () => {
    if (!yeniVardiya.trim()) return;
    setVardiyalar([...vardiyalar, yeniVardiya.trim()]);
    setYeniVardiya('');
  };

  const vardiyaSil = (index) => {
    setVardiyalar(vardiyalar.filter((_, i) => i !== index));
  };

  const nedenEkle = () => {
    if (!yeniNeden.trim()) return;
    setNedenler([...nedenler, yeniNeden.trim()]);
    setYeniNeden('');
  };

  const nedenSil = (index) => {
    setNedenler(nedenler.filter((_, i) => i !== index));
  };

  const arizalariYukle = async (işletmeIdParam) => {
    try {
      const q = query(collection(db, 'duruslar'), where('işletme_id', '==', işletmeIdParam));
      const querySnapshot = await getDocs(q);
      const arizaList = [];
      querySnapshot.forEach((doc) => {
        arizaList.push({ id: doc.id, ...doc.data() });
      });
      setArizalar(arizaList);
      const aktifSay = arizaList.filter(a => a.status === 'bildirildi').length;
      setActiveArizaCount(aktifSay);
    } catch (error) {
      console.error('Arızalar yüklenemedi:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lutfen email ve sifre girin');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert('Giriş Hatası', error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Başarılı', 'Şifre sıfırlama maili gönderildi. Email hesabınızı kontrol edin.');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  const handleDemoLogin = () => {
    setIsDemoMode(true);
    setUser({ uid: 'demo-user', email: 'demo@ycmms.local' });
    setUserRole('demo');
    setİşletmeId('demo');
    setMusteriNo('DEMO');
    setMakineler(['Makine 1', 'Makine 2', 'Makine 3']);
    setIsimler(['Teknisyen 1', 'Teknisyen 2']);
    setVardiyalar(['Vardiya 1', 'Vardiya 2', 'Vardiya 3']);
    setNedenler(['Mekanik', 'Elektrik', 'Operatör']);
    setArizalar([]);
    setActiveArizaCount(0);
    setCurrentScreen('menu');
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setUser(null);
      setEmail('');
      setPassword('');
      setMusteriNo('');
      setAccountMenuOpen(false);
      setCurrentScreen('login');
      return;
    }
    try {
      await signOut(auth);
      setEmail('');
      setPassword('');
      setMusteriNo('');
      setAccountMenuOpen(false);
      setCurrentScreen('login');
    } catch (error) {
      Alert.alert('Çıkış Hatası', error.message);
    }
  };

  const handleSwitchAccount = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setUser(null);
    } else {
      try {
        await signOut(auth);
      } catch (error) {
        console.log('Switch account error:', error.message);
      }
    }
    setEmail('');
    setPassword('');
    setMusteriNo('');
    setAccountMenuOpen(false);
    setCurrentScreen('login');
  };

  const veriyiKaydet = async () => {
    if (!selectedMakine || !tarihBaslangic || !saatBaslangic) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }
    try {
      if (isDemoMode) {
        const demoAriza = {
          id: `demo-${Date.now()}`,
          işletme_id: 'demo',
          makine_adi: selectedMakine,
          siparis_no: siparisNo,
          aciklama,
          tarih_baslangic: tarihBaslangic,
          saat_baslangic: saatBaslangic,
          status: 'bildirildi',
        };
        const nextArizalar = [demoAriza, ...arizalar];
        setArizalar(nextArizalar);
        setActiveArizaCount(nextArizalar.filter((a) => a.status === 'bildirildi').length);
        Alert.alert('Başarılı', 'Demo kayıt oluşturuldu');
        setTarihBaslangic(formatCurrentDateTr());
        setSaatBaslangic(formatCurrentTime5Min());
        setSelectedMakine('');
        setSiparisNo('');
        setAciklama('');
        setCurrentScreen('menu');
        return;
      }

      await addDoc(collection(db, 'duruslar'), {
        işletme_id: işletmeId,
        makine_adi: selectedMakine,
        siparis_no: siparisNo,
        aciklama: aciklama,
        tarih_baslangic: tarihBaslangic,
        saat_baslangic: saatBaslangic,
        status: 'bildirildi',
        kayit_tarihi: serverTimestamp(),
      });
      Alert.alert('Başarılı', 'Arıza bildirildi');
      setTarihBaslangic(formatCurrentDateTr());
      setSaatBaslangic(formatCurrentTime5Min());
      setSelectedMakine('');
      setSiparisNo('');
      setAciklama('');
      await arizalariYukle(işletmeId);
      setCurrentScreen('menu');
    } catch (error) {
      Alert.alert('Hata', 'Veri kaydedilemedi: ' + error.message);
    }
  };

  const guncelleAriza = async () => {
    if (!bakimTeknisyen || !mudahaleBaslangic) {
      Alert.alert('Hata', 'Lütfen gerekli alanları doldurun');
      return;
    }
    try {
      const responseTime = dakikaFarki(
        selectedAriza.tarih_baslangic,
        selectedAriza.saat_baslangic,
        selectedAriza.tarih_baslangic,
        mudahaleBaslangic
      );

      if (responseTime === null || responseTime < 0) {
        Alert.alert('Hata', 'Müdahale saati başlangıç saatinden küçük olamaz');
        return;
      }

      if (isDemoMode) {
        const nextArizalar = arizalar.map((ariza) => {
          if (ariza.id !== selectedAriza.id) return ariza;
          return {
            ...ariza,
            bakim_vardiya: bakimVardiya,
            bakim_teknisyen: bakimTeknisyen,
            bakim_neden: bakimNeden,
            bakim_aciklama: bakimAciklama,
            mudahale_baslangic: mudahaleBaslangic,
            tarih_bitis: bakimTarihBitis,
            saat_bitis: bakimSaatBitis,
            status: 'tamamlandi',
            response_time: responseTime,
          };
        });
        setArizalar(nextArizalar);
        setActiveArizaCount(nextArizalar.filter((a) => a.status === 'bildirildi').length);
        Alert.alert('Başarılı', 'Demo arıza güncellendi');
        setCurrentScreen('bakimAktif');
        return;
      }

      await updateDoc(doc(db, 'duruslar', selectedAriza.id), {
        bakim_vardiya: bakimVardiya,
        bakim_teknisyen: bakimTeknisyen,
        bakim_neden: bakimNeden,
        bakim_aciklama: bakimAciklama,
        mudahale_baslangic: mudahaleBaslangic,
        tarih_bitis: bakimTarihBitis,
        saat_bitis: bakimSaatBitis,
        status: 'tamamlandi',
        response_time: responseTime,
      });
      Alert.alert('Başarılı', 'Arıza güncellendi');
      await arizalariYukle(işletmeId);
      setCurrentScreen('bakimAktif');
    } catch (error) {
      Alert.alert('Hata', 'Güncelleme başarısız: ' + error.message);
    }
  };

  const hesaplaSure = (tarihBas, saatBas, tarihBit, saatBit) => {
    try {
      const [gB, aB, yB] = tarihBas.split(/[./]/);
      const [saatB, dakB] = saatBas.split(':');
      const bas = new Date(yB, aB - 1, gB, saatB, dakB);

      const [gBit, aBit, yBit] = tarihBit.split(/[./]/);
      const [saatBitVal, dakBitVal] = saatBit.split(':');
      const bit = new Date(yBit, aBit - 1, gBit, saatBitVal, dakBitVal);

      const diff = Math.round((bit - bas) / (1000 * 60));
      return diff + ' dk';
    } catch {
      return '-';
    }
  };

  const parseTrDateTime = (tarih, saat) => {
    if (!tarih || !saat) return null;
    const [g, a, y] = tarih.split(/[./]/).map(Number);
    const [s, d] = saat.split(':').map(Number);
    if (!g || !a || !y || Number.isNaN(s) || Number.isNaN(d)) return null;
    const parsed = new Date(y, a - 1, g, s, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const dakikaFarki = (tarihBas, saatBas, tarihBit, saatBit) => {
    const bas = parseTrDateTime(tarihBas, saatBas);
    const bit = parseTrDateTime(tarihBit, saatBit);
    if (!bas || !bit) return null;
    return Math.round((bit - bas) / (1000 * 60));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (!user) {
    return (
      <KeyboardAvoidingView
        style={styles.loginContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.loginBackgroundOrbTop} />
        <View style={styles.loginBackgroundOrbBottom} />
        <ScrollView
          contentContainerStyle={styles.loginScrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.loginCard}>
            <View style={styles.loginCardHeader}>
              <Text style={styles.loginTitle}>Giriş</Text>
              <Text style={styles.loginSubtitle}>Hesabina erismek icin giris bilgilerini yaz</Text>
            </View>

            <TextInput
              style={styles.loginInput}
              placeholder="Musteri No (Opsiyonel)"
              placeholderTextColor="#8a96a8"
              value={musteriNo}
              onChangeText={setMusteriNo}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.loginInput}
              placeholder="Email veya Kullanici Adi"
              placeholderTextColor="#8a96a8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.loginInput}
              placeholder="Sifre"
              placeholderTextColor="#8a96a8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.loginForgotLink} onPress={handleForgotPassword}>
              <Text style={styles.loginForgotText}>Sifremi unuttum?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginPrimaryButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>GIRIS YAP</Text>
            </TouchableOpacity>

            <View style={styles.loginFooterRow}>
              <Text style={styles.loginFooterText}>Hizli erisim ister misin?</Text>
              <TouchableOpacity style={styles.loginDemoLink} onPress={handleDemoLogin}>
                <Text style={styles.loginDemoText}>Demo Giris</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginSecondaryButton} onPress={handleDemoLogin}>
              <Text style={styles.loginButtonTextCompact}>DEMO GİRİŞ (ŞİFRESİZ)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'menu') {
    return (
      <View style={styles.menuContainer}>
        <View style={styles.menuBackgroundOrbTop} />
        <View style={styles.menuBackgroundOrbBottom} />

        <TouchableOpacity
          style={[styles.userBadge, styles.menuUserBadge]}
          onPress={() => setAccountMenuOpen(!accountMenuOpen)}
        >
          <Text style={styles.menuUserBadgeText}>
            {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'U')}
          </Text>
        </TouchableOpacity>
        {accountMenuOpen && (
          <View style={styles.accountMenuOverlay}>
            <View style={styles.accountMenuPanel}>
              <Text style={styles.accountMenuTitle}>Hesap</Text>
              <View style={styles.accountMenuUser}>
                <View style={styles.accountMenuAvatar}>
                  <Text style={styles.accountMenuAvatarText}>
                    {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'U')}
                  </Text>
                </View>
                <Text style={styles.accountMenuEmail} numberOfLines={1}>
                  {isDemoMode ? 'DEMO MOD' : (user?.email || '')}
                </Text>
              </View>
              <TouchableOpacity style={styles.accountMenuButton} onPress={handleLogout}>
                <Text style={styles.accountMenuButtonText}>Çıkış Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accountMenuButton} onPress={handleSwitchAccount}>
                <Text style={styles.accountMenuButtonText}>Başka Hesapla Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.menuTopSpace} />

        <View style={styles.menuHeaderCard}>
          <Text style={styles.menuHeaderTitle}>Kontrol Paneli</Text>
          <Text style={styles.menuHeaderSubtitle}>GİRİŞ</Text>
        </View>

        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuTile} onPress={() => setCurrentScreen('uretim')}>
            <Text style={styles.menuTileTitle}>ÜRETİM</Text>
            <Text style={styles.menuTileSubtitle}>Bildirim oluştur</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuTile, activeArizaCount > 0 ? styles.menuTileAlert : null]}
            onPress={() => setCurrentScreen('bakim')}
          >
            <Text style={styles.menuTileTitle}>BAKIM</Text>
            <Text style={styles.menuTileSubtitle}>Açık bildirimleri yönet</Text>
            {activeArizaCount > 0 && (
              <View style={styles.menuTileBadge}>
                <Text style={styles.menuTileBadgeText}>{activeArizaCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuTile} onPress={() => setCurrentScreen('proje')}>
            <Text style={styles.menuTileTitle}>PROJE</Text>
            <Text style={styles.menuTileSubtitle}>Proje ekranına geç</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuTile} onPress={() => setCurrentScreen('yonetim')}>
            <Text style={styles.menuTileTitle}>YÖNETİM</Text>
            <Text style={styles.menuTileSubtitle}>Rapor ve ayarlar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSummaryCard}>
          <Text style={styles.menuSummaryLabel}>Bu ay açık iş emirleri</Text>
          <Text style={styles.menuSummaryValue}>{activeArizaCount}</Text>
        </View>
      </View>
    );
  }

  if (currentScreen === 'uretim') {
    return (
      <KeyboardAvoidingView
        style={styles.uretimContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.uretimBackgroundOrbTop} />
        <View style={styles.uretimBackgroundOrbBottom} />

        <ScrollView
          ref={uretimScrollRef}
          contentContainerStyle={[styles.uretimScrollContainer, styles.keyboardBottomSpaceCompact]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.uretimHeaderRow}>
            <TouchableOpacity
              style={styles.uretimBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Text style={styles.uretimBackButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.uretimHeaderRight}>
              <View style={styles.uretimAvatarBadge}>
                <Text style={styles.uretimAvatarText}>
                  {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.uretimTitle}>ÜRETİM</Text>

          <View style={[styles.formCard, styles.uretimFormCard]}>
            <Text style={[styles.label, styles.uretimLabel]}>Başlangıç Tarihi</Text>
            <TouchableOpacity onPress={() => setShowDatePickerBas(true)}>
              <TextInput
                style={[styles.input, styles.uretimInput]}
                value={tarihBaslangic}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            {showDatePickerBas && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePickerBas(false);
                  if (selectedDate) {
                    setTarihBaslangic(selectedDate.toLocaleDateString('tr-TR'));
                  }
                }}
              />
            )}

            <Text style={[styles.label, styles.uretimLabel]}>Başlangıç Saati</Text>
            <View style={[styles.pickerContainer, styles.uretimPickerContainer]}>
              <Picker
                selectedValue={saatBaslangic}
                onValueChange={(val) => setSaatBaslangic(val)}
              >
                <Picker.Item label="Seçiniz" value="" />
                {Array.from({ length: 24 }, (_, h) => h).map(h =>
                  Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => {
                    const saat = `${h.toString().padStart(2, '0')}:${m}`;
                    return <Picker.Item key={saat} label={saat} value={saat} />;
                  })
                ).flat()}
              </Picker>
            </View>

            <Text style={[styles.label, styles.uretimLabel]}>Makine</Text>
            <View style={[styles.pickerContainer, styles.uretimPickerContainer]}>
              <Picker
                selectedValue={selectedMakine}
                onValueChange={(val) => setSelectedMakine(val)}
              >
                <Picker.Item label="Seçiniz" value="" />
                {makineler.map((m) => (
                  <Picker.Item key={m} label={m} value={m} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.label, styles.uretimLabel]}>Sipariş No</Text>
            <TextInput
              style={[styles.input, styles.uretimInput]}
              value={siparisNo}
              onChangeText={setSiparisNo}
              placeholder="Sipariş numarası"
            />

            <Text style={[styles.label, styles.uretimLabel]}>Açıklama (İstek/Talep)</Text>
            <TextInput
              style={[styles.input, styles.uretimInput, { height: 74, textAlignVertical: 'top' }]}
              value={aciklama}
              onChangeText={setAciklama}
              placeholder="Arıza açıklaması"
              multiline
              onFocus={() => {
                setTimeout(() => {
                  uretimScrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />

            <TouchableOpacity style={[styles.buton, styles.uretimSubmitButton]} onPress={veriyiKaydet}>
              <Text style={styles.butonMetin}>BİLDİR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uretimBackInlineButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Text style={styles.uretimBackInlineText}>‹ GERİ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'bakim') {
    return (
      <View style={styles.bakimContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.bakimAvatarBadge}>
            <Text style={styles.bakimAvatarText}>
              {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
            </Text>
          </View>
        </View>

        <Text style={styles.bakimTitle}>BAKIM</Text>

        <View style={styles.bakimGrid}>
          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimAktif')}>
            <Text style={styles.bakimTileTitle}>AÇIK BİLDİRİMLER</Text>
            <Text style={styles.bakimTileSubtitle}>Aktif arıza kayıtları</Text>
            {activeArizaCount > 0 && (
              <View style={styles.bakimTileBadge}>
                <Text style={styles.bakimTileBadgeText}>{activeArizaCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimGecmis')}>
            <Text style={styles.bakimTileTitle}>GEÇMİŞ ARIZALAR</Text>
            <Text style={styles.bakimTileSubtitle}>Tamamlanan işler</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimYillik')}>
            <Text style={styles.bakimTileTitle}>YILLIK BAKIM</Text>
            <Text style={styles.bakimTileSubtitle}>Planlı yıllık bakım</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimHaftalik')}>
            <Text style={styles.bakimTileTitle}>HAFTALIK BAKIM</Text>
            <Text style={styles.bakimTileSubtitle}>Rutin haftalık bakım</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTileWide} onPress={() => setCurrentScreen('bakimBina')}>
            <Text style={styles.bakimTileTitle}>BİNA BAKIM</Text>
            <Text style={styles.bakimTileSubtitle}>Bina bakım işlemleri</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTileWide} onPress={() => setCurrentScreen('bakimYardimci')}>
            <Text style={styles.bakimTileTitle}>YARDIMCI İŞLETMELER</Text>
            <Text style={styles.bakimTileSubtitle}>Destek sistemleri</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimAktif') {
    const aktifArizalar = arizalar.filter(a => a.status === 'bildirildi');
    return (
      <View style={styles.bakimAktifContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('bakim')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.bakimAvatarBadge}>
            <Text style={styles.bakimAvatarText}>
              {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
            </Text>
          </View>
        </View>

        <Text style={styles.bakimTitle}>AÇIK BİLDİRİMLER</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
          {aktifArizalar.length === 0 ? (
            <Text style={styles.bakimAktifEmptyText}>Aktif arıza yok</Text>
          ) : (
            aktifArizalar.map((ariza) => (
              <TouchableOpacity
                key={ariza.id}
                style={styles.bakimAktifCard}
                onPress={() => {
                  setSelectedAriza(ariza);
                  setBakimVardiya('');
                  setBakimTeknisyen('');
                  setBakimNeden('');
                  setBakimAciklama('');
                  setMudahaleBaslangic(formatCurrentTime5Min());
                  setBakimTarihBitis(formatCurrentDateTr());
                  setBakimSaatBitis(formatCurrentTime5Min());
                  setCurrentScreen('bakimDetail');
                }}
              >
                <Text style={styles.bakimAktifDateText}>
                  {ariza.tarih_baslangic} {ariza.saat_baslangic}
                </Text>
                <Text style={styles.bakimAktifMachineText}>
                  {ariza.makine_adi}
                </Text>
                <Text numberOfLines={2} style={styles.bakimAktifDescText}>
                  {ariza.aciklama || 'Açıklama yok'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimGecmis') {
    const gecmisArizalar = arizalar.filter(a => a.status === 'tamamlandi');
    return (
      <View style={styles.bakimGecmisContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('bakim')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.bakimAvatarBadge}>
            <Text style={styles.bakimAvatarText}>
              {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
            </Text>
          </View>
        </View>

        <Text style={styles.bakimTitle}>GEÇMİŞ ARIZALAR</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimGecmisScrollContent}>
          {gecmisArizalar.length === 0 ? (
            <Text style={styles.bakimAktifEmptyText}>Geçmiş arıza yok</Text>
          ) : (
            gecmisArizalar.map((ariza) => (
              <TouchableOpacity
                key={ariza.id}
                style={styles.bakimGecmisCard}
                onPress={() => {
                  const sure = hesaplaSure(
                    ariza.tarih_baslangic,
                    ariza.saat_baslangic,
                    ariza.tarih_bitis || ariza.tarih_baslangic,
                    ariza.saat_bitis || ariza.saat_baslangic
                  );
                  Alert.alert(
                    'Arıza Detayı',
                    `Makine: ${ariza.makine_adi}\n` +
                    `Başlangıç: ${ariza.tarih_baslangic} ${ariza.saat_baslangic}\n` +
                    `Bitiş: ${ariza.tarih_bitis || '-'} ${ariza.saat_bitis || '-'}\n` +
                    `Duruş Süresi: ${sure}\n` +
                    `Teknisyen: ${ariza.bakim_teknisyen || '-'}\n` +
                    `Neden: ${ariza.bakim_neden || '-'}\n` +
                    `Response Time: ${ariza.response_time || '-'} dk\n` +
                    `Açıklama: ${ariza.aciklama || '-'}`
                  );
                }}
              >
                <Text style={styles.bakimGecmisDateText}>
                  {ariza.tarih_baslangic} {ariza.saat_baslangic}
                </Text>
                <Text style={styles.bakimGecmisMachineText}>
                  {ariza.makine_adi}
                </Text>
                <Text style={styles.bakimGecmisTechText}>
                  Teknisyen: {ariza.bakim_teknisyen || '-'}
                </Text>
                <Text style={styles.bakimGecmisResponseText}>
                  Response: {ariza.response_time || '-'} dk
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimDetail' && selectedAriza) {
    const mudahaleDakika = dakikaFarki(
      selectedAriza.tarih_baslangic,
      selectedAriza.saat_baslangic,
      selectedAriza.tarih_baslangic,
      mudahaleBaslangic
    );
    const durusDakika = dakikaFarki(
      selectedAriza.tarih_baslangic,
      selectedAriza.saat_baslangic,
      bakimTarihBitis,
      bakimSaatBitis
    );

    return (
      <KeyboardAvoidingView
        style={styles.kapanisContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.kapanisBackgroundOrbTop} />
        <View style={styles.kapanisBackgroundOrbBottom} />

        <ScrollView
          ref={bakimDetailScrollRef}
          contentContainerStyle={[styles.kapanisScrollContainer, styles.keyboardBottomSpaceCompact]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.kapanisHeaderRow}>
            <TouchableOpacity
              style={styles.kapanisBackButton}
              onPress={() => setCurrentScreen('bakimAktif')}
            >
              <Text style={styles.kapanisBackButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.kapanisHeaderRight}>
              <View style={styles.kapanisAvatarBadge}>
                <Text style={styles.kapanisAvatarText}>
                  {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.kapanisTitle}>KAPANIŞ</Text>

          <View style={[styles.formCard, styles.kapanisFormCard]}>
            <Text style={[styles.label, styles.kapanisLabel]}>Sipariş No</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.kapanisInput]}
              value={selectedAriza.siparis_no || '-'}
              editable={false}
            />

            <Text style={[styles.label, styles.kapanisLabel]}>Arıza Başlangıç Tarihi</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.kapanisInput]}
              value={selectedAriza.tarih_baslangic || '-'}
              editable={false}
            />

            <Text style={[styles.label, styles.kapanisLabel]}>Arıza Başlangıç Saati</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.kapanisInput]}
              value={selectedAriza.saat_baslangic || '-'}
              editable={false}
            />

            <Text style={[styles.label, styles.kapanisLabel]}>Makina</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.kapanisInput]}
              value={selectedAriza.makine_adi || '-'}
              editable={false}
            />

            <Text style={[styles.label, styles.kapanisLabel]}>Talep</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.kapanisInput, { height: 60, textAlignVertical: 'top' }]}
              value={selectedAriza.aciklama || '-'}
              editable={false}
              multiline
            />

            <Text style={[styles.label, styles.kapanisLabel]}>Müdahale Saati</Text>
            <View style={[styles.pickerContainer, styles.kapanisPicker]}>
              <Picker
                selectedValue={mudahaleBaslangic}
                onValueChange={(val) => setMudahaleBaslangic(val)}
              >
                {Array.from({ length: 24 }, (_, h) => h).map(h =>
                  Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => {
                    const saat = `${h.toString().padStart(2, '0')}:${m}`;
                    return <Picker.Item key={saat} label={saat} value={saat} />;
                  })
                ).flat()}
              </Picker>
            </View>

            <View style={[styles.sureKutusu, styles.kapanisSureKutusu]}>
              <Text style={styles.sureText}>
                Müdahaleye Kadar Geçen Süre: {mudahaleDakika === null ? '-' : `${mudahaleDakika} dk`}
              </Text>
            </View>

            <Text style={[styles.label, styles.kapanisLabel]}>Arıza Bitiş Tarihi</Text>
            <TouchableOpacity onPress={() => setShowDatePickerBit(true)}>
              <TextInput
                style={[styles.input, styles.kapanisInput]}
                value={bakimTarihBitis}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            {showDatePickerBit && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePickerBit(false);
                  if (selectedDate) {
                    setBakimTarihBitis(selectedDate.toLocaleDateString('tr-TR'));
                  }
                }}
              />
            )}

            <Text style={[styles.label, styles.kapanisLabel]}>Arıza Bitiş Saati</Text>
            <View style={[styles.pickerContainer, styles.kapanisPicker]}>
              <Picker
                selectedValue={bakimSaatBitis}
                onValueChange={(val) => setBakimSaatBitis(val)}
              >
                {Array.from({ length: 24 }, (_, h) => h).map(h =>
                  Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => {
                    const saat = `${h.toString().padStart(2, '0')}:${m}`;
                    return <Picker.Item key={saat} label={saat} value={saat} />;
                  })
                ).flat()}
              </Picker>
            </View>

            <View style={[styles.sureKutusu, styles.kapanisSureKutusu]}>
              <Text style={styles.sureText}>
                Duruş Süresi: {durusDakika === null ? '-' : `${durusDakika} dk`}
              </Text>
            </View>

            <Text style={[styles.label, styles.kapanisLabel]}>Teknisyen</Text>
            <View style={[styles.pickerContainer, styles.kapanisPicker]}>
              <Picker
                selectedValue={bakimTeknisyen}
                onValueChange={(val) => setBakimTeknisyen(val)}
              >
                <Picker.Item label="Seçiniz" value="" />
                {isimler.map((i) => (
                  <Picker.Item key={i} label={i} value={i} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.label, styles.kapanisLabel]}>Vardiya</Text>
            <View style={[styles.pickerContainer, styles.kapanisPicker]}>
              <Picker
                selectedValue={bakimVardiya}
                onValueChange={(val) => setBakimVardiya(val)}
              >
                <Picker.Item label="Seçiniz" value="" />
                {vardiyalar.map((v) => (
                  <Picker.Item key={v} label={v} value={v} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.label, styles.kapanisLabel]}>Duruş Nedeni</Text>
            <View style={[styles.pickerContainer, styles.kapanisPicker]}>
              <Picker
                selectedValue={bakimNeden}
                onValueChange={(val) => setBakimNeden(val)}
              >
                <Picker.Item label="Seçiniz" value="" />
                {nedenler.map((n) => (
                  <Picker.Item key={n} label={n} value={n} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.label, styles.kapanisLabel]}>Açıklama (Yapılan İşlem)</Text>
            <TextInput
              style={[styles.input, styles.kapanisInput, { height: 70, textAlignVertical: 'top' }]}
              value={bakimAciklama}
              onChangeText={setBakimAciklama}
              placeholder="Yapılan işlemleri yazın"
              multiline
            />

            <TouchableOpacity style={[styles.buton, styles.kapanisSubmitButton]} onPress={guncelleAriza}>
              <Text style={styles.butonMetin}>KAYDET</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.kapanisBackInlineButton}
              onPress={() => setCurrentScreen('bakimAktif')}
            >
              <Text style={styles.kapanisBackInlineText}>‹ GERİ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'bakimYillik') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YILLIK BAKIM</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimHaftalik') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>HAFTALIK BAKIM</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimBina') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>BİNA BAKIM</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimYardimci') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YARDIMCI İŞLETMELER</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('bakim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'proje') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>PROJE</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'yonetim') {
    return (
      <View style={styles.yonetimContainer}>
        <View style={styles.yonetimBackgroundOrbTop} />
        <View style={styles.yonetimBackgroundOrbBottom} />

        <View style={styles.yonetimHeaderRow}>
          <TouchableOpacity
            style={styles.yonetimBackButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Text style={styles.yonetimBackButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.yonetimAvatarBadge}>
            <Text style={styles.yonetimAvatarText}>
              {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
            </Text>
          </View>
        </View>

        <Text style={styles.yonetimTitle}>YÖNETİM</Text>

        <ScrollView contentContainerStyle={styles.yonetimScrollContent}>
          <View style={styles.yonetimGrid}>
            <TouchableOpacity
              style={styles.yonetimTile}
              onPress={() => setCurrentScreen('yonetimYillik')}
            >
              <Text style={styles.yonetimTileTitle}>YILLIK</Text>
              <Text style={styles.yonetimTileSubtitle}>BAKIM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.yonetimTile}
              onPress={() => setCurrentScreen('yonetimHaftalik')}
            >
              <Text style={styles.yonetimTileTitle}>HAFTALIK</Text>
              <Text style={styles.yonetimTileSubtitle}>BAKIM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.yonetimTile}
              onPress={() => setCurrentScreen('yonetimProje')}
            >
              <Text style={styles.yonetimTileTitle}>PROJE</Text>
              <Text style={styles.yonetimTileSubtitle}>YÖNETİMİ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.yonetimTile}
              onPress={() => setCurrentScreen('yonetimVeri')}
            >
              <Text style={styles.yonetimTileTitle}>VERİ</Text>
              <Text style={styles.yonetimTileSubtitle}>GİRİŞİ</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.yonetimTileFullWidth}
            onPress={() => setCurrentScreen('yonetimPareto')}
          >
            <Text style={styles.yonetimTileTitle}>PARETO</Text>
            <Text style={styles.yonetimTileSubtitle}>ANALİZİ</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.yonetimBackInlineButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.yonetimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'yonetimYillik') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YÖNETİM - YILLIK BAKIM</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('yonetim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'yonetimHaftalik') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YÖNETİM - HAFTALIK BAKIM</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('yonetim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'yonetimProje') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YÖNETİM - PROJE</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('yonetim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'yonetimVeri') {
    return (
      <KeyboardAvoidingView
        style={styles.veriGirisContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.veriGirisBackgroundOrbTop} />
        <View style={styles.veriGirisBackgroundOrbBottom} />

        <ScrollView contentContainerStyle={[styles.veriGirisScrollContent, styles.keyboardBottomSpaceCompact]}>
          <View style={styles.veriGirisHeaderRow}>
            <TouchableOpacity
              style={styles.veriGirisBackButton}
              onPress={() => setCurrentScreen('yonetim')}
            >
              <Text style={styles.veriGirisBackButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.veriGirisAvatarBadge}>
              <Text style={styles.veriGirisAvatarText}>
                {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'K')}
              </Text>
            </View>
          </View>

          <Text style={styles.veriGirisTitle}>VERİ GİRİŞİ</Text>

          <View style={[styles.formCard, styles.veriGirisCard]}>
            <Text style={styles.veriGirisSectionTitle}>MAKİNELER</Text>
            {makineler.map((m, index) => (
              <View key={index} style={styles.veriGirisListItem}>
                <Text style={styles.veriGirisListItemText}>{m}</Text>
                <TouchableOpacity
                  style={styles.veriGirisDeleteBtn}
                  onPress={() => makineSil(index)}
                >
                  <Text style={styles.veriGirisDeleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.veriGirisAddRow}>
              <TextInput
                style={[styles.input, styles.veriGirisInput]}
                value={yeniMakine}
                onChangeText={setYeniMakine}
                placeholder="Makine adı"
              />
              <TouchableOpacity
                style={[styles.buton, styles.veriGirisAddBtn]}
                onPress={makineEkle}
              >
                <Text style={styles.butonMetin}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.formCard, styles.veriGirisCard]}>
            <Text style={styles.veriGirisSectionTitle}>TEKNİSYENLER</Text>
            {isimler.map((i, index) => (
              <View key={index} style={styles.veriGirisListItem}>
                <Text style={styles.veriGirisListItemText}>{i}</Text>
                <TouchableOpacity
                  style={styles.veriGirisDeleteBtn}
                  onPress={() => isimSil(index)}
                >
                  <Text style={styles.veriGirisDeleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.veriGirisAddRow}>
              <TextInput
                style={[styles.input, styles.veriGirisInput]}
                value={yeniIsim}
                onChangeText={setYeniIsim}
                placeholder="Teknisyen adı"
              />
              <TouchableOpacity
                style={[styles.buton, styles.veriGirisAddBtn]}
                onPress={isimEkle}
              >
                <Text style={styles.butonMetin}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.formCard, styles.veriGirisCard]}>
            <Text style={styles.veriGirisSectionTitle}>VARDİYALAR</Text>
            {vardiyalar.map((v, index) => (
              <View key={index} style={styles.veriGirisListItem}>
                <Text style={styles.veriGirisListItemText}>{v}</Text>
                <TouchableOpacity
                  style={styles.veriGirisDeleteBtn}
                  onPress={() => vardiyaSil(index)}
                >
                  <Text style={styles.veriGirisDeleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.veriGirisAddRow}>
              <TextInput
                style={[styles.input, styles.veriGirisInput]}
                value={yeniVardiya}
                onChangeText={setYeniVardiya}
                placeholder="Vardiya adı"
              />
              <TouchableOpacity
                style={[styles.buton, styles.veriGirisAddBtn]}
                onPress={vardiyaEkle}
              >
                <Text style={styles.butonMetin}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.formCard, styles.veriGirisCard]}>
            <Text style={styles.veriGirisSectionTitle}>DURUŞ NEDENLERİ</Text>
            {nedenler.map((n, index) => (
              <View key={index} style={styles.veriGirisListItem}>
                <Text style={styles.veriGirisListItemText}>{n}</Text>
                <TouchableOpacity
                  style={styles.veriGirisDeleteBtn}
                  onPress={() => nedenSil(index)}
                >
                  <Text style={styles.veriGirisDeleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.veriGirisAddRow}>
              <TextInput
                style={[styles.input, styles.veriGirisInput]}
                value={yeniNeden}
                onChangeText={setYeniNeden}
                placeholder="Duruş nedeni"
              />
              <TouchableOpacity
                style={[styles.buton, styles.veriGirisAddBtn]}
                onPress={nedenEkle}
              >
                <Text style={styles.butonMetin}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.buton, styles.veriGirisSaveBtn]}
            onPress={ayarlariKaydet}
          >
            <Text style={styles.butonMetin}>KAYDET</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.veriGirisBackInlineButton}
          onPress={() => setCurrentScreen('yonetim')}
        >
          <Text style={styles.veriGirisBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'yonetimPareto') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>YÖNETİM - PARETO ANALİZİ</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('yonetim')}
        >
          <Text style={styles.butonMetin}>GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ecf0f1',
    paddingTop: 50,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  keyboardBottomSpace: {
    paddingBottom: 220,
  },
  keyboardBottomSpaceCompact: {
    paddingBottom: 120,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  baslik: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 30,
  },
  userBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    fontSize: 11,
    color: '#7f8c8d',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    fontWeight: '600',
  },
  userBadgeScroll: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#7f8c8d',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  buton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: 'center',
    position: 'relative',
  },
  butonMetin: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  readOnlyInput: {
    backgroundColor: '#f4f6f8',
    color: '#2c3e50',
  },
  formCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    marginBottom: 15,
  },
  arizaCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#95a5a6',
    fontSize: 16,
    marginTop: 50,
  },
  bilgiText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
    fontWeight: '500',
  },
  sureKutusu: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    marginVertical: 15,
    alignItems: 'center',
  },
  sureText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecf0f1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  deleteBtn: {
    backgroundColor: '#e74c3c',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    position: 'relative',
  },
  loginBackgroundOrbTop: {
    position: 'absolute',
    top: -70,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.28)',
  },
  loginBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(125, 205, 240, 0.22)',
  },
  loginScrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  loginCardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#16334a',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#32546b',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  loginCard: {
    backgroundColor: '#b7e8fb',
    borderRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
    shadowColor: '#042b62',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  loginInput: {
    backgroundColor: '#eef5fb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    fontSize: 16,
    color: '#1b3347',
    fontWeight: '600',
  },
  loginForgotLink: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  loginForgotText: {
    color: '#3b78c0',
    fontSize: 14,
    fontWeight: '700',
  },
  loginPrimaryButton: {
    backgroundColor: '#3a85da',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 26,
  },
  loginSecondaryButton: {
    backgroundColor: '#4a93e3',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  loginFooterRow: {
    alignItems: 'center',
    marginBottom: 2,
  },
  loginFooterText: {
    color: '#1f3d54',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  loginDemoLink: {
    paddingVertical: 2,
  },
  loginDemoText: {
    color: '#20588e',
    fontSize: 21,
    fontWeight: '700',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  loginButtonTextCompact: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  uretimContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    position: 'relative',
  },
  uretimBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  uretimBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  uretimScrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 22,
  },
  uretimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  uretimHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uretimBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uretimBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  uretimAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uretimAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  uretimTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 10,
  },
  uretimFormCard: {
    backgroundColor: '#b7e8fb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  uretimLabel: {
    marginTop: 4,
    marginBottom: 4,
  },
  uretimInput: {
    marginBottom: 9,
    paddingVertical: 10,
  },
  uretimPickerContainer: {
    marginBottom: 9,
  },
  uretimSubmitButton: {
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: '#3a85da',
  },
  uretimBackInlineButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  uretimBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 82,
    backgroundColor: '#0f4ea8',
    position: 'relative',
  },
  menuBackgroundOrbTop: {
    position: 'absolute',
    top: -90,
    left: -75,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  menuBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  menuUserBadge: {
    top: 52,
    right: 18,
    backgroundColor: '#1f2a44',
    color: '#f8fafc',
  },
  menuTopSpace: {
    height: 8,
  },
  menuUserBadgeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  menuHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d7e3f0',
  },
  menuHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4b5d7a',
    textAlign: 'center',
  },
  menuHeaderSubtitle: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
    color: '#1f2a44',
    textAlign: 'center',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuTile: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 118,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d7e3f0',
  },
  menuTileAlert: {
    backgroundColor: '#dce9f7',
  },
  menuTileTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2a44',
  },
  menuTileSubtitle: {
    fontSize: 13,
    color: '#41536f',
    fontWeight: '600',
  },
  menuTileBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuTileBadgeText: {
    color: '#d6333b',
    fontWeight: '800',
    fontSize: 12,
  },
  menuSummaryCard: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7e3f0',
  },
  menuSummaryLabel: {
    color: '#41536f',
    fontSize: 14,
    fontWeight: '700',
  },
  menuSummaryValue: {
    color: '#1f2a44',
    fontSize: 28,
    fontWeight: '800',
  },
  bakimContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  bakimBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  bakimBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  bakimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bakimBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bakimBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  bakimAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bakimAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  bakimTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 10,
  },
  bakimGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bakimTile: {
    width: '48.4%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e3f0',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 114,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  bakimTileWide: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e3f0',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 88,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  bakimTileTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1f2a44',
  },
  bakimTileSubtitle: {
    fontSize: 14,
    color: '#45597a',
    fontWeight: '600',
  },
  bakimTileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  bakimTileBadgeText: {
    color: '#d6333b',
    fontWeight: '800',
    fontSize: 12,
  },
  bakimBackInlineButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  bakimBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  bakimAktifContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  bakimAktifScrollContent: {
    paddingBottom: 8,
  },
  bakimAktifEmptyText: {
    textAlign: 'center',
    color: '#d8e4f5',
    fontSize: 18,
    marginTop: 44,
    fontWeight: '700',
  },
  bakimAktifCard: {
    backgroundColor: '#fbe5e7',
    borderColor: '#f2b8be',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#db5a66',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  bakimAktifDateText: {
    fontSize: 14,
    color: '#5a6475',
    marginBottom: 6,
    fontWeight: '600',
  },
  bakimAktifMachineText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2a44',
    marginBottom: 6,
  },
  bakimAktifDescText: {
    fontSize: 15,
    color: '#384a63',
    fontWeight: '600',
  },
  bakimGecmisContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  bakimGecmisScrollContent: {
    paddingBottom: 8,
  },
  bakimGecmisCard: {
    backgroundColor: '#e8f7ee',
    borderColor: '#b7e5c8',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#2f9e61',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  bakimGecmisDateText: {
    fontSize: 14,
    color: '#4f6670',
    marginBottom: 6,
    fontWeight: '600',
  },
  bakimGecmisMachineText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2a44',
    marginBottom: 6,
  },
  bakimGecmisTechText: {
    fontSize: 15,
    color: '#325b49',
    marginBottom: 4,
    fontWeight: '600',
  },
  bakimGecmisResponseText: {
    fontSize: 14,
    color: '#3a6750',
    fontWeight: '600',
  },
  kapanisContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    position: 'relative',
  },
  kapanisBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  kapanisBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  kapanisScrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 22,
  },
  kapanisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kapanisHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kapanisBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kapanisBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  kapanisAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kapanisAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  kapanisTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 10,
  },
  kapanisFormCard: {
    backgroundColor: '#b7e8fb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  kapanisSubmitButton: {
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: '#3a85da',
  },
  kapanisBackInlineButton: {
    alignSelf: 'flex-end',
    marginRight: 0,
    marginTop: 10,
    marginBottom: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  kapanisBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  kapanisLabel: {
    marginTop: 2,
    marginBottom: 2,
  },
  kapanisInput: {
    marginBottom: 6,
    paddingVertical: 8,
  },
  kapanisPicker: {
    marginBottom: 6,
  },
  kapanisSureKutusu: {
    marginTop: 3,
    marginBottom: 6,
  },
  yonetimContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  yonetimBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  yonetimBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  yonetimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  yonetimBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yonetimBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  yonetimAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yonetimAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  yonetimTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 14,
  },
  yonetimScrollContent: {
    paddingBottom: 80,
  },
  yonetimGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  yonetimTile: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#0f4ea8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  yonetimTileFullWidth: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    shadowColor: '#0f4ea8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  yonetimTileTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f4ea8',
    textAlign: 'center',
  },
  yonetimTileSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a85da',
    textAlign: 'center',
    marginTop: 4,
  },
  yonetimBackInlineButton: {
    position: 'absolute',
    bottom: 44,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  yonetimBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  veriGirisContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    position: 'relative',
  },
  veriGirisBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  veriGirisBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  veriGirisScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 100,
  },
  veriGirisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  veriGirisBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veriGirisBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  veriGirisAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veriGirisAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  veriGirisTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 14,
  },
  veriGirisCard: {
    backgroundColor: '#b7e8fb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  veriGirisSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f4ea8',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  veriGirisListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  veriGirisListItemText: {
    fontSize: 13,
    color: '#1f2a44',
    fontWeight: '600',
    flex: 1,
  },
  veriGirisDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veriGirisDeleteBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  veriGirisAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  veriGirisInput: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: 10,
    fontSize: 13,
  },
  veriGirisAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#3a85da',
    borderRadius: 10,
    minWidth: 44,
  },
  veriGirisSaveBtn: {
    backgroundColor: '#2f9e61',
    marginTop: 12,
    marginBottom: 20,
  },
  veriGirisBackInlineButton: {
    position: 'absolute',
    bottom: 44,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  veriGirisBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
});

