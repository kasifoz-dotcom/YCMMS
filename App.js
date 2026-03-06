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
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const formatCurrentDateTr = () => new Date().toLocaleDateString('tr-TR');
const formatCurrentDateIso = () => new Date().toISOString().slice(0, 10);
const formatDateIso = (date) => date.toISOString().slice(0, 10);

const formatCurrentTime5Min = () => {
  const now = new Date();
  const roundedMinutes = Math.floor(now.getMinutes() / 5) * 5;
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = roundedMinutes.toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Yıllık Bakım için hafta numarası hesaplama
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

const getCurrentWeekAndYear = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    week: getWeekNumber(now)
  };
};

const getMondayOfWeek = (year, week) => {
  const jan4 = new Date(year, 0, 4);
  const dayNum = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayNum + 1);
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetMonday;
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

  // Haftalık Bakım states
  const [haftalikBakimListesi, setHaftalikBakimListesi] = useState([]);
  const [haftalikBakimTamamlandi, setHaftalikBakimTamamlandi] = useState([]);
  const [selectedHaftalikBakim, setSelectedHaftalikBakim] = useState(null);
  const [haftalikTabActive, setHaftalikTabActive] = useState('yapilacak'); // 'yapilacak' veya 'tamamlanmis'
  
  // Haftalık Bakım Form states
  const [hbMakineAdi, setHbMakineAdi] = useState('');
  const [hbGunTarihi, setHbGunTarihi] = useState(formatCurrentDateIso());
  const [hbBaslangicSaat, setHbBaslangicSaat] = useState('09:00');
  const [hbBitisSaat, setHbBitisSaat] = useState('16:00');
  const [hbTamamlamaSaati, setHbTamamlamaSaati] = useState(formatCurrentTime5Min());
  const [hbAciklama, setHbAciklama] = useState('');
  const [showHbDatePicker, setShowHbDatePicker] = useState(false);
  const [showHbBaslangicPicker, setShowHbBaslangicPicker] = useState(false);
  const [showHbBitisPicker, setShowHbBitisPicker] = useState(false);
  const [showHbTamamlamaPicker, setShowHbTamamlamaPicker] = useState(false);
  const [haftalikYapildi, setHaftalikYapildi] = useState(false);
  const [showPTamamlaDatePicker, setShowPTamamlaDatePicker] = useState(false);

  // Planlama - Haftalık Bakım Planlama states
  const [planlamaHbMakine, setPlanlamaHbMakine] = useState('');
  const [planlamaHbGun, setPlanlamaHbGun] = useState('');
  const [planlamaHbBaslangic, setPlanlamaHbBaslangic] = useState('08:00');
  const [planlamaHbBitis, setPlanlamaHbBitis] = useState('17:00');
  const [showPlanlamaHbBaslangicPicker, setShowPlanlamaHbBaslangicPicker] = useState(false);
  const [showPlanlamaHbBitisPicker, setShowPlanlamaHbBitisPicker] = useState(false);

  // Yıllık Bakım states
  const [yillikBakimListesi, setYillikBakimListesi] = useState([]);
  const [yillikBakimTamamlandi, setYillikBakimTamamlandi] = useState([]);
  const [selectedYillikBakim, setSelectedYillikBakim] = useState(null);
  const [yillikTabActive, setYillikTabActive] = useState('yapilacak');
  
  // Yıllık Bakım Form states
  const [ybMakineAdi, setYbMakineAdi] = useState('');
  const [ybYil, setYbYil] = useState('2026');
  const [ybBaslangicHafta, setYbBaslangicHafta] = useState('');
  const [ybBitisHafta, setYbBitisHafta] = useState('');
  const [ybTamamlamaTarihi, setYbTamamlamaTarihi] = useState(formatCurrentDateIso());
  const [ybTamamlamaSaati, setYbTamamlamaSaati] = useState(formatCurrentTime5Min());
  const [ybAciklama, setYbAciklama] = useState('');
  const [showYbTamamlamaTarihPicker, setShowYbTamamlamaTarihPicker] = useState(false);
  const [showYbTamamlamaSaatPicker, setShowYbTamamlamaSaatPicker] = useState(false);
  const [yillikYapildi, setYillikYapildi] = useState(false);

  // Planlama - Yıllık Bakım Planlama states
  const [planlamaYbMakine, setPlanlamaYbMakine] = useState('');
  const [planlamaYbYil, setPlanlamaYbYil] = useState('2026');
  const [planlamaYbBaslangicHafta, setPlanlamaYbBaslangicHafta] = useState('');
  const [planlamaYbBitisHafta, setPlanlamaYbBitisHafta] = useState('');

  // Ayarlar
  const [isimler, setIsimler] = useState([]);
  const [vardiyalar, setVardiyalar] = useState([]);
  const [makineler, setMakineler] = useState([]);
  const [nedenler, setNedenler] = useState([]);
  const [ayarlarDocId, setAyarlarDocId] = useState(null);

  // Proje Planlama states
  const [projeListesi, setProjeListesi] = useState([]);
  const [projeTamamlandi, setProjeTamamlandi] = useState([]);
  const [projeOnayBekliyor, setProjeOnayBekliyor] = useState([]);
  const [selectedProje, setSelectedProje] = useState(null);
  const [projeTabActive, setProjeTabActive] = useState('yapilacak');

  // Proje Form states
  const [pProjeAdi, setPProjeAdi] = useState('');
  const [pBaslangicTarihi, setPBaslangicTarihi] = useState(formatCurrentDateIso());
  const [pBitisTarihi, setPBitisTarihi] = useState('');
  const [pProjeYoneticisi, setPProjeYoneticisi] = useState('');
  const [pAmac, setPAmac] = useState('');
  const [pKapsam, setPKapsam] = useState('');
  const [showPBaslangicPicker, setShowPBaslangicPicker] = useState(false);
  const [showPBitisPicker, setShowPBitisPicker] = useState(false);

  // Proje Tamamla Form states
  const [pTamamlamaTarihi, setPTamamlamaTarihi] = useState(formatCurrentDateIso());
  const [pSonucNotu, setPSonucNotu] = useState('');
  const [showPTamamlamaPicker, setShowPTamamlamaPicker] = useState(false);
  const [projeTamamlandı, setProjeTamamlandı] = useState(false);

  // Proje Bütçe states
  const [projeButceListesi, setProjeButceListesi] = useState([]);
  const [pBBilyer, setPBBilyer] = useState('');
  const [pBMiktar, setPBMiktar] = useState('');
  const [pBBirimFiyat, setPBBirimFiyat] = useState('');

  // Proje Risk states
  const [projeRiskListesi, setProjeRiskListesi] = useState([]);
  const [pRiskAciklama, setPRiskAciklama] = useState('');
  const [pRiskOlasilik, setPRiskOlasilik] = useState('Düşük');
  const [pRiskEtki, setPRiskEtki] = useState('Düşük');
  const [pRiskBPlani, setPRiskBPlani] = useState('');

  // Planlama - Proje Planlama states
  const [planlamaPProjeAdi, setPlanlamaPProjeAdi] = useState('');
  const [planlamaPBaslangic, setPlanlamaPBaslangic] = useState(formatCurrentDateIso());
  const [planlamaPBitis, setPlanlamaPBitis] = useState('');
  const [planlamaPYoneticisi, setPlanlamaPYoneticisi] = useState('');
  const [planlamaPAmac, setPlanlamaPAmac] = useState('');
  const [planlamaPKapsam, setPlanlamaPKapsam] = useState('');
  const [showPlanlamaPBaslangicPicker, setShowPlanlamaPBaslangicPicker] = useState(false);
  const [showPlanlamaPBitisPicker, setShowPlanlamaPBitisPicker] = useState(false);

  // Veri Girişi states
  const [yeniMakine, setYeniMakine] = useState('');
  const [yeniIsim, setYeniIsim] = useState('');
  const [yeniVardiya, setYeniVardiya] = useState('');
  const [yeniNeden, setYeniNeden] = useState('');

  // Hesap Menüsü
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  
  // Yan Menü
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  // Bina Bakım (Basit)
  const [binaBakimTab, setBinaBakimTab] = useState('bildir');
  const [binaBakimKonum, setBinaBakimKonum] = useState('');
  const [binaBakimKategori, setBinaBakimKategori] = useState('');
  const [binaBakimAciklama, setBinaBakimAciklama] = useState('');
  const [binaBakimOncelik, setBinaBakimOncelik] = useState('Orta');
  const [binaArizaKayitlari, setBinaArizaKayitlari] = useState([]);
  
  // BAKIM Ekranında Bina Arızaları
  const [bakimBinaBildirimler, setBakimBinaBildirimler] = useState([]);
  
  // BAKIM ekranındaki BİNA BAKIM sekmesi
  const [binaBakimTabActive, setBinaBakimTabActive] = useState('bildirimler');
  
  // Yardımcı İşletmeler - Seçili sistem
  const [secilidestekSistemi, setSecilidestekSistemi] = useState(null);

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
          await haftalikBakimYukle(isletmeIdDetermined);
          await haftalikBakimTamamlandiYukle(isletmeIdDetermined);
          await yillikBakimYukle(isletmeIdDetermined);
          await yillikBakimTamamlandiYukle(isletmeIdDetermined);
          await projeYukle(isletmeIdDetermined);
          await projeTamamlandiYukle(isletmeIdDetermined);
          await projeOnayBekliyorYukle(isletmeIdDetermined);
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
          await haftalikBakimYukle(currentUser.email);
          await haftalikBakimTamamlandiYukle(currentUser.email);
        }
      } else {
        setUser(null);
        setCurrentScreen('menu');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // İşletmeId değişince proje verilerini yeniden yükle
  useEffect(() => {
    if (işletmeId && işletmeId.trim()) {
      const reloadProjeData = async () => {
        try {
          await projeYukle(işletmeId);
          await projeTamamlandiYukle(işletmeId);
          await projeOnayBekliyorYukle(işletmeId);
          // Haftalık ve yıllık bakım verilerini de yükle
          await haftalikBakimYukle(işletmeId);
          await haftalikBakimTamamlandiYukle(işletmeId);
          await yillikBakimYukle(işletmeId);
          await yillikBakimTamamlandiYukle(işletmeId);
        } catch (error) {
          console.error('Veri yenileme hatası:', error);
        }
      };
      reloadProjeData();
    }
  }, [işletmeId]);

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

  const haftalikBakimYukle = async (işletmeIdParam) => {
    try {
      const q = query(collection(db, 'haftalikBakimlar'), where('işletme_id', '==', işletmeIdParam));
      const querySnapshot = await getDocs(q);
      const haftalikList = [];
      querySnapshot.forEach((doc) => {
        haftalikList.push({ id: doc.id, ...doc.data() });
      });
      setHaftalikBakimListesi(haftalikList);
    } catch (error) {
      console.error('Haftalık bakımlar yüklenemedi:', error);
    }
  };

  const haftalikBakimTamamlandiYukle = async (işletmeIdParam) => {
    try {
      const q = query(collection(db, 'haftalikBakimTamamlandi'), where('işletme_id', '==', işletmeIdParam));
      const querySnapshot = await getDocs(q);
      const tamamlandiList = [];
      querySnapshot.forEach((doc) => {
        tamamlandiList.push({ id: doc.id, ...doc.data() });
      });
      setHaftalikBakimTamamlandi(tamamlandiList);
    } catch (error) {
      console.error('Tamamlanan haftalık bakımlar yüklenemedi:', error);
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

  const haftalikBakimTamamla = async () => {
    if (!hbMakineAdi || !hbBaslangicSaat || !hbBitisSaat || !hbAciklama) {
      Alert.alert('Hata', 'Lütfen gerekli alanları doldurun');
      return;
    }

    try {
      const bakimData = {
        makine_adi: hbMakineAdi,
        gun_tarihi: hbGunTarihi,
        baslangic_saat: hbBaslangicSaat,
        bitis_saat: hbBitisSaat,
        tamamlama_saati: hbTamamlamaSaati,
        aciklama: hbAciklama,
        yapan_kisi: user?.email || 'Bilinmiyor',
        işletme_id: işletmeId,
      };

      if (isDemoMode) {
        const newTamamlandi = [...haftalikBakimTamamlandi];
        newTamamlandi.push({ id: Date.now().toString(), ...bakimData });
        setHaftalikBakimTamamlandi(newTamamlandi);
        
        // Yapılacaktan kaldır (plan statusunu güncelle)
        if (selectedHaftalikBakim?.id) {
          const newList = haftalikBakimListesi.map(b => {
            if (b.id === selectedHaftalikBakim.id) {
              return { ...b, status: 'tamamlandi' };
            }
            return b;
          });
          setHaftalikBakimListesi(newList);
        }
        
        Alert.alert('Başarılı', 'Demo haftalık bakım kaydedildi');
      } else {
        await addDoc(collection(db, 'haftalikBakimTamamlandi'), bakimData);
        
        // Plana status ekle (silmek yerine)
        if (selectedHaftalikBakim?.id) {
          try {
            await updateDoc(doc(db, 'haftalikBakimlar', selectedHaftalikBakim.id), {
              status: 'tamamlandi',
            });
            console.log('Plan statusu güncellendi:', selectedHaftalikBakim.id);
          } catch (updateError) {
            console.error('Plan status güncelleme hatası:', updateError);
          }
        }
        
        Alert.alert('Başarılı', 'Haftalık bakım kaydedildi');
        
        await haftalikBakimTamamlandiYukle(işletmeId);
        await haftalikBakimYukle(işletmeId);
      }

      // Formu sıfırla
      setHbMakineAdi('');
      setHbGunTarihi(formatCurrentDateIso());
      setHbBaslangicSaat('09:00');
      setHbBitisSaat('16:00');
      setHbTamamlamaSaati(formatCurrentTime5Min());
      setHbAciklama('');
      setHaftalikYapildi(false);
      setSelectedHaftalikBakim(null);
      setCurrentScreen('bakimHaftalikAna');
      setHaftalikTabActive('tamamlanmis');
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız: ' + error.message);
    }
  };

  const haftalikBakimEkle = async () => {
    if (!planlamaHbMakine || !planlamaHbGun || !planlamaHbBaslangic || !planlamaHbBitis) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    try {
      const gunAdlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
      const bakimData = {
        makine_adi: planlamaHbMakine,
        gun: parseInt(planlamaHbGun),
        gun_adi: gunAdlari[parseInt(planlamaHbGun)],
        baslangic_saat: planlamaHbBaslangic,
        bitis_saat: planlamaHbBitis,
        işletme_id: işletmeId,
        olusturma_tarihi: formatCurrentDateTr(),
        aktif: true,
      };

      if (isDemoMode) {
        const newList = [...haftalikBakimListesi];
        newList.push({ id: Date.now().toString(), ...bakimData });
        setHaftalikBakimListesi(newList);
        Alert.alert('Başarılı', 'Demo haftalık bakım planı eklendi');
      } else {
        await addDoc(collection(db, 'haftalikBakimlar'), bakimData);
        Alert.alert('Başarılı', 'Haftalık bakım planı eklendi');
        await haftalikBakimYukle(işletmeId);
      }

      // Formu sıfırla
      setPlanlamaHbMakine('');
      setPlanlamaHbGun('');
      setPlanlamaHbBaslangic('08:00');
      setPlanlamaHbBitis('17:00');
    } catch (error) {
      Alert.alert('Hata', 'Ekleme başarısız: ' + error.message);
    }
  };

  const haftalikBakimSil = async (bakimId, makineAdi) => {
    try {
      if (isDemoMode) {
        // Plan listesinden sil
        const newList = haftalikBakimListesi.filter(b => b.id !== bakimId);
        setHaftalikBakimListesi(newList);
        
        // O makineye ait tamamlanmış kayıtları da sil
        const newTamamlandi = haftalikBakimTamamlandi.filter(t => t.makine_adi !== makineAdi);
        setHaftalikBakimTamamlandi(newTamamlandi);
        
        Alert.alert('Başarılı', 'Plan ve tamamlanmış kayıtlar silindi');
      } else {
        // Planı sil
        await deleteDoc(doc(db, 'haftalikBakimlar', bakimId));
        
        // O makineye ait tüm tamamlanmış kayıtları sil
        const q = query(
          collection(db, 'haftalikBakimTamamlandi'),
          where('makine_adi', '==', makineAdi),
          where('işletme_id', '==', işletmeId)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(docSnap.ref));
        });
        await Promise.all(deletePromises);
        
        Alert.alert('Başarılı', 'Plan ve tamamlanmış kayıtlar silindi');
        await haftalikBakimYukle(işletmeId);
        await haftalikBakimTamamlandiYukle(işletmeId);
      }
    } catch (error) {
      Alert.alert('Hata', 'Silme başarısız: ' + error.message);
    }
  };

  // ======= YILLIK BAKIM FONKSİYONLARI =======
  
  const yillikBakimYukle = async (işletmeIdParam) => {
    if (!işletmeIdParam) return;
    try {
      const q = query(
        collection(db, 'yillikBakimlar'),
        where('işletme_id', '==', işletmeIdParam)
      );
      const snapshot = await getDocs(q);
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setYillikBakimListesi(liste);
    } catch (error) {
      console.error('Yıllık bakım yükleme hatası:', error);
    }
  };

  const yillikBakimTamamlandiYukle = async (işletmeIdParam) => {
    if (!işletmeIdParam) return;
    try {
      const q = query(
        collection(db, 'yillikBakimTamamlandi'),
        where('işletme_id', '==', işletmeIdParam)
      );
      const snapshot = await getDocs(q);
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setYillikBakimTamamlandi(liste);
    } catch (error) {
      console.error('Yıllık bakım tamamlandı yükleme hatası:', error);
    }
  };

  const yillikBakimEkle = async () => {
    if (!planlamaYbMakine || !planlamaYbYil || !planlamaYbBaslangicHafta || !planlamaYbBitisHafta) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    const baslangic = parseInt(planlamaYbBaslangicHafta);
    const bitis = parseInt(planlamaYbBitisHafta);

    if (baslangic < 1 || baslangic > 52 || bitis < 1 || bitis > 52) {
      Alert.alert('Hata', 'Hafta numarası 1-52 arasında olmalı');
      return;
    }

    if (baslangic > bitis) {
      Alert.alert('Hata', 'Başlangıç haftası bitiş haftasından büyük olamaz');
      return;
    }

    try {
      const bakimData = {
        makine_adi: planlamaYbMakine,
        yil: parseInt(planlamaYbYil),
        baslangic_hafta: baslangic,
        bitis_hafta: bitis,
        işletme_id: işletmeId,
        olusturma_tarihi: formatCurrentDateTr(),
        status: 'aktif',
      };

      if (isDemoMode) {
        const newList = [...yillikBakimListesi];
        newList.push({ id: Date.now().toString(), ...bakimData });
        setYillikBakimListesi(newList);
        Alert.alert('Başarılı', 'Demo yıllık bakım planı eklendi');
      } else {
        await addDoc(collection(db, 'yillikBakimlar'), bakimData);
        Alert.alert('Başarılı', 'Yıllık bakım planı eklendi');
        await yillikBakimYukle(işletmeId);
      }

      // Formu sıfırla
      setPlanlamaYbMakine('');
      setPlanlamaYbYil('2026');
      setPlanlamaYbBaslangicHafta('');
      setPlanlamaYbBitisHafta('');
    } catch (error) {
      Alert.alert('Hata', 'Ekleme başarısız: ' + error.message);
    }
  };

  const yillikBakimSil = async (bakimId, makineAdi, yil, baslangicHafta, bitisHafta) => {
    try {
      if (isDemoMode) {
        const newList = yillikBakimListesi.filter(b => b.id !== bakimId);
        setYillikBakimListesi(newList);
        
        // O makine+yıl+hafta aralığına ait tamamlanmış kayıtları sil
        const newTamamlandi = yillikBakimTamamlandi.filter(t => 
          !(t.makine_adi === makineAdi && t.yil === yil && 
            t.baslangic_hafta === baslangicHafta && t.bitis_hafta === bitisHafta)
        );
        setYillikBakimTamamlandi(newTamamlandi);
        
        Alert.alert('Başarılı', 'Plan ve tamamlanmış kayıtlar silindi');
      } else {
        // Planı sil
        await deleteDoc(doc(db, 'yillikBakimlar', bakimId));
        
        // O plana ait tüm tamamlanmış kayıtları sil
        const q = query(
          collection(db, 'yillikBakimTamamlandi'),
          where('makine_adi', '==', makineAdi),
          where('yil', '==', yil),
          where('baslangic_hafta', '==', baslangicHafta),
          where('bitis_hafta', '==', bitisHafta),
          where('işletme_id', '==', işletmeId)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(docSnap.ref));
        });
        await Promise.all(deletePromises);
        
        Alert.alert('Başarılı', 'Plan ve tamamlanmış kayıtlar silindi');
        await yillikBakimYukle(işletmeId);
        await yillikBakimTamamlandiYukle(işletmeId);
      }
    } catch (error) {
      Alert.alert('Hata', 'Silme başarısız: ' + error.message);
    }
  };

  const yillikBakimTamamla = async () => {
    if (!ybMakineAdi || !ybYil || !ybBaslangicHafta || !ybBitisHafta || !ybAciklama || !yillikYapildi) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun ve onay kutusunu işaretleyin');
      return;
    }

    try {
      const bakimData = {
        makine_adi: ybMakineAdi,
        yil: parseInt(ybYil),
        baslangic_hafta: parseInt(ybBaslangicHafta),
        bitis_hafta: parseInt(ybBitisHafta),
        tamamlama_tarihi: ybTamamlamaTarihi,
        tamamlama_saati: ybTamamlamaSaati,
        aciklama: ybAciklama,
        yapan_kisi: user?.email || 'Bilinmiyor',
        işletme_id: işletmeId,
      };

      if (isDemoMode) {
        const newTamamlandi = [...yillikBakimTamamlandi];
        newTamamlandi.push({ id: Date.now().toString(), ...bakimData });
        setYillikBakimTamamlandi(newTamamlandi);
        
        // Planı status güncellemesi
        if (selectedYillikBakim?.id) {
          const newList = yillikBakimListesi.map(b => {
            if (b.id === selectedYillikBakim.id) {
              return { ...b, status: 'tamamlandi' };
            }
            return b;
          });
          setYillikBakimListesi(newList);
        }
        
        Alert.alert('Başarılı', 'Demo yıllık bakım kaydedildi');
      } else {
        await addDoc(collection(db, 'yillikBakimTamamlandi'), bakimData);
        
        // Plana status ekle
        if (selectedYillikBakim?.id) {
          try {
            await updateDoc(doc(db, 'yillikBakimlar', selectedYillikBakim.id), {
              status: 'tamamlandi',
            });
            console.log('Yıllık plan statusu güncellendi:', selectedYillikBakim.id);
          } catch (updateError) {
            console.error('Yıllık plan status güncelleme hatası:', updateError);
          }
        }
        
        Alert.alert('Başarılı', 'Yıllık bakım kaydedildi');
        
        await yillikBakimTamamlandiYukle(işletmeId);
        await yillikBakimYukle(işletmeId);
      }

      // Formu sıfırla
      setYbMakineAdi('');
      setYbYil('2026');
      setYbBaslangicHafta('');
      setYbBitisHafta('');
      setYbTamamlamaTarihi(formatCurrentDateIso());
      setYbTamamlamaSaati(formatCurrentTime5Min());
      setYbAciklama('');
      setYillikYapildi(false);
      setSelectedYillikBakim(null);
      setCurrentScreen('bakimYillikAna');
      setYillikTabActive('tamamlanmis');
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız: ' + error.message);
    }
  };

  // ======= PROJE FONKSİYONLARI =======

  const getKayitIsletmeId = (kayit) => {
    return (
      kayit?.işletme_id ||
      kayit?.isletme_id ||
      kayit?.isletme_kimligi ||
      kayit?.isletme_kimliği ||
      kayit?.['işletme_kimliği'] ||
      ''
    );
  };

  const getKayitStatus = (kayit) => {
    return kayit?.status || kayit?.durum || '';
  };

  const projeYukle = async (işletmeIdParam) => {
    if (!işletmeIdParam) return;
    try {
      const snapshot = await getDocs(collection(db, 'projeler'));
      const liste = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p) => getKayitIsletmeId(p) === işletmeIdParam)
        .filter((p) => getKayitStatus(p) !== 'onay_bekliyor');
      setProjeListesi(liste);
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
    }
  };

  const projeTamamlandiYukle = async (işletmeIdParam) => {
    if (!işletmeIdParam) return;
    try {
      const snapshot = await getDocs(collection(db, 'projeTamamlandi'));
      const liste = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p) => getKayitIsletmeId(p) === işletmeIdParam);
      setProjeTamamlandi(liste);
    } catch (error) {
      console.error('Proje tamamlandı yükleme hatası:', error);
    }
  };

  const projeOnayBekliyorYukle = async (işletmeIdParam) => {
    if (!işletmeIdParam) return;
    try {
      const snapshot = await getDocs(collection(db, 'projeler'));
      const liste = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p) => getKayitIsletmeId(p) === işletmeIdParam)
        .filter((p) => getKayitStatus(p) === 'onay_bekliyor');
      setProjeOnayBekliyor(liste);
    } catch (error) {
      console.error('Onay bekleyen proje yükleme hatası:', error);
    }
  };

  const projeEkle = async () => {
    const projeAdi = (planlamaPProjeAdi || '').trim();
    const bitis = (planlamaPBitis || '').trim();
    const yonetici = (planlamaPYoneticisi || '').trim();
    const amac = (planlamaPAmac || '').trim();

    if (!projeAdi || !bitis || !yonetici || !amac) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    try {
      const projeData = {
        proje_adi: projeAdi,
        baslangic_tarihi: planlamaPBaslangic,
        bitis_tarihi: bitis,
        proje_yoneticisi: yonetici,
        amac: amac,
        kapsam: planlamaPKapsam,
        işletme_id: işletmeId,
        isletme_kimligi: işletmeId,
        olusturma_tarihi: formatCurrentDateTr(),
        status: 'aktif',
        durum: 'aktif',
      };

      if (isDemoMode) {
        const newList = [...projeListesi];
        newList.push({ id: Date.now().toString(), ...projeData });
        setProjeListesi(newList);
        Alert.alert('Başarılı', 'Demo proje eklendi');
      } else {
        const docRef = await addDoc(collection(db, 'projeler'), projeData);
        setProjeListesi((prev) => [...prev, { id: docRef.id, ...projeData }]);
        Alert.alert('Başarılı', 'Proje eklendi');
        try {
          await projeYukle(işletmeId);
        } catch (reloadError) {
          console.error('Proje liste yenileme hatası:', reloadError);
        }
      }

      // Formu sıfırla
      setPlanlamaPProjeAdi('');
      setPlanlamaPBaslangic(formatCurrentDateIso());
      setPlanlamaPBitis('');
      setPlanlamaPYoneticisi('');
      setPlanlamaPAmac('');
      setPlanlamaPKapsam('');
    } catch (error) {
      Alert.alert('Hata', 'Ekleme başarısız: ' + error.message);
    }
  };

  const projeSil = async (projeId, projeAdi) => {
    try {
      if (isDemoMode) {
        const newList = projeListesi.filter(p => p.id !== projeId);
        setProjeListesi(newList);
        Alert.alert('Başarılı', 'Proje silindi');
      } else {
        await deleteDoc(doc(db, 'projeler', projeId));
        
        // O projeye ait bütçe ve risk kayıtlarını sil
        const butceQ = query(collection(db, 'projeButce'), where('proje_id', '==', projeId));
        const butceSnap = await getDocs(butceQ);
        const butceDeletes = [];
        butceSnap.forEach(doc => butceDeletes.push(deleteDoc(doc.ref)));
        
        const riskQ = query(collection(db, 'projeRisk'), where('proje_id', '==', projeId));
        const riskSnap = await getDocs(riskQ);
        const riskDeletes = [];
        riskSnap.forEach(doc => riskDeletes.push(deleteDoc(doc.ref)));
        
        await Promise.all([...butceDeletes, ...riskDeletes]);
        
        Alert.alert('Başarılı', 'Proje ve ilişkili veriler silindi');
        await projeYukle(işletmeId);
      }
    } catch (error) {
      Alert.alert('Hata', 'Silme başarısız: ' + error.message);
    }
  };

  const projeTamamlayaGonder = async () => {
    if (!pProjeAdi || !pSonucNotu || !projeTamamlandı) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun ve onay kutusunu işaretleyin');
      return;
    }

    try {
      const projeData = {
        proje_adi: pProjeAdi,
        baslangic_tarihi: selectedProje.baslangic_tarihi,
        termin_tarihi: selectedProje.bitis_tarihi,
        gercek_bitis_tarihi: pTamamlamaTarihi,
        proje_yoneticisi: selectedProje.proje_yoneticisi,
        amac: selectedProje.amac,
        kapsam: selectedProje.kapsam,
        sonuc_notu: pSonucNotu,
        yapan_kisi: user?.email || 'Bilinmiyor',
        işletme_id: işletmeId,
        isletme_kimligi: işletmeId,
        olusturma_tarihi: selectedProje.olusturma_tarihi,
      };

      if (isDemoMode) {
        const newTamamlandi = [...projeTamamlandi];
        newTamamlandi.push({ id: Date.now().toString(), ...projeData });
        setProjeTamamlandi(newTamamlandi);
        
        // Plandan status güncelle
        if (selectedProje?.id) {
          const newList = projeListesi.map(p => {
            if (p.id === selectedProje.id) {
              return { ...p, status: 'onay_bekliyor' };
            }
            return p;
          });
          setProjeListesi(newList);
        }
        
        Alert.alert('Başarılı', 'Demo proje tamamlamaya gönderildi');
      } else {
        await addDoc(collection(db, 'projeTamamlandi'), projeData);
        
        // Plana status ekle (onay_bekliyor)
        if (selectedProje?.id) {
          try {
            await updateDoc(doc(db, 'projeler', selectedProje.id), {
              status: 'onay_bekliyor',
              durum: 'onay_bekliyor',
            });
            console.log('Proje onay bekliyora taşındı:', selectedProje.id);
          } catch (updateError) {
            console.error('Proje status güncelleme hatası:', updateError);
          }
        }
        
        Alert.alert('Başarılı', 'Proje tamamlamaya gönderildi. Yönetici onayı bekleniyor');
        
        await projeYukle(işletmeId);
        await projeTamamlandiYukle(işletmeId);
        await projeOnayBekliyorYukle(işletmeId);
      }

      // Formu sıfırla
      setPProjeAdi('');
      setPBaslangicTarihi(formatCurrentDateIso());
      setPBitisTarihi('');
      setPProjeYoneticisi('');
      setPAmac('');
      setPKapsam('');
      setPTamamlamaTarihi(formatCurrentDateIso());
      setPSonucNotu('');
      setProjeTamamlandı(false);
      setSelectedProje(null);
      setCurrentScreen('bakimProjesi');
      setProjeTabActive('yapilacak');
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız: ' + error.message);
    }
  };

  const projeOnayla = async (projeId) => {
    try {
      if (isDemoMode) {
        Alert.alert('Başarılı', 'Proje onaylandı (Demo)');
        await projeOnayBekliyorYukle(işletmeId);
      } else {
        // Onay bekleyen koleksiyonundan sil ve tamamlandı olarak işaretle
        await updateDoc(doc(db, 'projeler', projeId), {
          status: 'tamamlandi',
          durum: 'tamamlandi',
          onay_tarihi: new Date().toISOString().slice(0, 10),
          onaylayan: user?.email || 'Bilinmiyor',
        });
        
        Alert.alert('Başarılı', 'Proje onaylandı');
        await projeOnayBekliyorYukle(işletmeId);
        await projeYukle(işletmeId);
        await projeTamamlandiYukle(işletmeId);
      }
    } catch (error) {
      Alert.alert('Hata', 'Onaylama başarısız: ' + error.message);
    }
  };

  const projeReddet = async (projeId) => {
    try {
      if (isDemoMode) {
        Alert.alert('Başarılı', 'Proje reddedildi (Demo)');
        await projeOnayBekliyorYukle(işletmeId);
      } else {
        // Onay bekleyen koleksiyonundan sil ve aktif yap
        await updateDoc(doc(db, 'projeler', projeId), {
          status: 'aktif',
          durum: 'aktif',
          red_tarihi: new Date().toISOString().slice(0, 10),
          redjeden: user?.email || 'Bilinmiyor',
        });
        
        Alert.alert('Bilgi', 'Proje reddedildi ve aktif duruma döndürüldü');
        await projeOnayBekliyorYukle(işletmeId);
        await projeYukle(işletmeId);
      }
    } catch (error) {
      Alert.alert('Hata', 'Reddetme başarısız: ' + error.message);
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

        {/* Hamburger Menü Butonu */}
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => setSideMenuOpen(true)}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>

        {/* Yan Menü */}
        {sideMenuOpen && (
          <View style={styles.sideMenuOverlay}>
            <TouchableOpacity 
              style={styles.sideMenuBackdrop}
              onPress={() => setSideMenuOpen(false)}
              activeOpacity={1}
            />
            <View style={styles.sideMenuPanel}>
              <View style={styles.sideMenuHeader}>
                <View style={styles.sideMenuAvatar}>
                  <Text style={styles.sideMenuAvatarText}>
                    {isDemoMode ? 'D' : (user?.email?.charAt(0).toUpperCase() || 'U')}
                  </Text>
                </View>
                <View style={styles.sideMenuUserInfo}>
                  <Text style={styles.sideMenuUserName} numberOfLines={1}>
                    {isDemoMode ? 'Demo Kullanıcı' : (user?.email?.split('@')[0] || 'Kullanıcı')}
                  </Text>
                  <Text style={styles.sideMenuUserEmail} numberOfLines={1}>
                    {isDemoMode ? 'demo@ycmms.com' : (user?.email || '')}
                  </Text>
                </View>
              </View>
              
              <View style={styles.sideMenuDivider} />
              
              <ScrollView style={styles.sideMenuItems}>
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => setSideMenuOpen(false)}>
                  <Text style={styles.sideMenuItemIcon}>👤</Text>
                  <Text style={styles.sideMenuItemText}>Profil</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => setSideMenuOpen(false)}>
                  <Text style={styles.sideMenuItemIcon}>⚙️</Text>
                  <Text style={styles.sideMenuItemText}>Ayarlar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => {
                  setSideMenuOpen(false);
                  handleSwitchAccount();
                }}>
                  <Text style={styles.sideMenuItemIcon}>🔄</Text>
                  <Text style={styles.sideMenuItemText}>Hesap Değiştir</Text>
                </TouchableOpacity>
                
                <View style={styles.sideMenuDivider} />
                
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => setSideMenuOpen(false)}>
                  <Text style={styles.sideMenuItemIcon}>ℹ️</Text>
                  <Text style={styles.sideMenuItemText}>Versiyon 1.0.0</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => setSideMenuOpen(false)}>
                  <Text style={styles.sideMenuItemIcon}>🔒</Text>
                  <Text style={styles.sideMenuItemText}>Gizlilik</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.sideMenuItem} onPress={() => setSideMenuOpen(false)}>
                  <Text style={styles.sideMenuItemIcon}>❓</Text>
                  <Text style={styles.sideMenuItemText}>Yardım Merkezi</Text>
                </TouchableOpacity>
                
                <View style={styles.sideMenuDivider} />
                
                <TouchableOpacity style={[styles.sideMenuItem, styles.sideMenuItemDanger]} onPress={() => {
                  setSideMenuOpen(false);
                  handleLogout();
                }}>
                  <Text style={styles.sideMenuItemIcon}>🚪</Text>
                  <Text style={styles.sideMenuItemTextDanger}>Çıkış Yap</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}

        <View style={styles.menuTopSpace} />

        <Text style={styles.menuHeaderTitle}>Kontrol Paneli</Text>
        <Text style={styles.menuHeaderSubtitle}>HOŞ GELDİN</Text>

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

          <TouchableOpacity style={styles.menuTile} onPress={() => setCurrentScreen('planlama')}>
            <Text style={styles.menuTileTitle}>PLANLAMA</Text>
            <Text style={styles.menuTileSubtitle}>Rapor ve ayarlar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuTile} onPress={() => setCurrentScreen('binaBakim')}>
            <Text style={styles.menuTileTitle}>BİNA BAKIM</Text>
            <Text style={styles.menuTileSubtitle}>Arıza bildir ve takip et</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSummaryCard}>
          <Text style={styles.menuSummaryLabel}>Bu ay açık iş emirleri</Text>
          <Text style={styles.menuSummaryValue}>{activeArizaCount}</Text>
        </View>
      </View>
    );
  }

  if (currentScreen === 'binaBakim') {
    return (
      <KeyboardAvoidingView
        style={styles.uretimContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.uretimBackgroundOrbTop} />
        <View style={styles.uretimBackgroundOrbBottom} />

        <ScrollView
          contentContainerStyle={[styles.uretimScrollContainer, styles.keyboardBottomSpaceCompact]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.bakimHeaderRow}>
            <TouchableOpacity
              style={styles.bakimBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Text style={styles.bakimBackButtonText}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bakimTitle}>BİNA BAKIM</Text>

          <View style={styles.binaBakimTabs}>
            <TouchableOpacity
              style={[styles.binaBakimTabButton, binaBakimTab === 'bildir' ? styles.binaBakimTabButtonActive : null]}
              onPress={() => setBinaBakimTab('bildir')}
            >
              <Text style={[styles.binaBakimTabText, binaBakimTab === 'bildir' ? styles.binaBakimTabTextActive : null]}>Arıza Bildir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.binaBakimTabButton, binaBakimTab === 'acik' ? styles.binaBakimTabButtonActive : null]}
              onPress={() => setBinaBakimTab('acik')}
            >
              <Text style={[styles.binaBakimTabText, binaBakimTab === 'acik' ? styles.binaBakimTabTextActive : null]}>Açık Arızalar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.binaBakimTabButton, binaBakimTab === 'kapali' ? styles.binaBakimTabButtonActive : null]}
              onPress={() => setBinaBakimTab('kapali')}
            >
              <Text style={[styles.binaBakimTabText, binaBakimTab === 'kapali' ? styles.binaBakimTabTextActive : null]}>Kapananlar</Text>
            </TouchableOpacity>
          </View>

          {binaBakimTab === 'bildir' ? (
            <View style={[styles.formCard, styles.uretimFormCard]}>
              <Text style={[styles.label, styles.uretimLabel]}>Konum</Text>
              <TextInput
                style={[styles.input, styles.uretimInput]}
                placeholder="Blok / Kat / Oda"
                value={binaBakimKonum}
                onChangeText={setBinaBakimKonum}
                placeholderTextColor="#8ea9bf"
              />

              <Text style={[styles.label, styles.uretimLabel]}>Kategori</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={binaBakimKategori}
                  onValueChange={(itemValue) => setBinaBakimKategori(itemValue)}
                >
                  <Picker.Item label="Seçiniz" value="" />
                  <Picker.Item label="Elektrik" value="Elektrik" />
                  <Picker.Item label="Su Tesisatı" value="Su Tesisatı" />
                  <Picker.Item label="Arıtma" value="Arıtma" />
                  <Picker.Item label="Mekanik" value="Mekanik" />
                  <Picker.Item label="HVAC" value="HVAC" />
                  <Picker.Item label="Kompresör" value="Kompresör" />
                  <Picker.Item label="Kazan" value="Kazan" />
                  <Picker.Item label="Güvenlik" value="Güvenlik" />
                  <Picker.Item label="Temizlik" value="Temizlik" />
                </Picker>
              </View>

              <Text style={[styles.label, styles.uretimLabel]}>Öncelik</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={binaBakimOncelik}
                  onValueChange={(itemValue) => setBinaBakimOncelik(itemValue)}
                >
                  <Picker.Item label="Düşük" value="Düşük" />
                  <Picker.Item label="Orta" value="Orta" />
                  <Picker.Item label="Yüksek" value="Yüksek" />
                </Picker>
              </View>

              <Text style={[styles.label, styles.uretimLabel]}>Açıklama</Text>
              <TextInput
                style={[styles.input, styles.uretimInput]}
                placeholder="Arıza açıklaması"
                value={binaBakimAciklama}
                onChangeText={setBinaBakimAciklama}
                placeholderTextColor="#8ea9bf"
              />

              <TouchableOpacity
                style={[styles.buton, styles.uretimSubmitButton]}
                onPress={() => {
                  if (!binaBakimKonum.trim() || !binaBakimKategori || !binaBakimAciklama.trim()) {
                    Alert.alert('Uyarı', 'Konum, kategori ve açıklama alanlarını doldurun.');
                    return;
                  }

                  const yeniKayit = {
                    id: Date.now().toString(),
                    konum: binaBakimKonum.trim(),
                    kategori: binaBakimKategori,
                    oncelik: binaBakimOncelik,
                    aciklama: binaBakimAciklama.trim(),
                    bildiren: isDemoMode ? 'DEMO' : (user?.email || 'Bilinmiyor'),
                    tarih: formatCurrentDateTr(),
                    saat: formatCurrentTime5Min(),
                    durum: 'Açık',
                  };

                  // Direkt bakımın BİNA BAKIM sekmesine gönder
                  setBakimBinaBildirimler((prev) => [yeniKayit, ...prev]);
                  setBinaBakimKonum('');
                  setBinaBakimKategori('');
                  setBinaBakimAciklama('');
                  setBinaBakimOncelik('Orta');
                  Alert.alert('Başarılı', 'Arıza BAKIM bölümüne gönderildi.');
                }}
              >
                <Text style={styles.butonMetin}>BİLDİR</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.binaBakimListWrap}>
              {binaBakimTab === 'acik' ? (
                // Açık Arızalar - BAKIM'e gönderilen ama henüz kapatılmamış arızalar
                <>
                  {bakimBinaBildirimler.filter((item) => item.durum !== 'Kapalı').length === 0 ? (
                    <View style={[styles.formCard, styles.uretimFormCard]}>
                      <Text style={styles.binaBakimEmptyText}>
                        Henüz açık arıza kaydı yok.
                      </Text>
                    </View>
                  ) : (
                    bakimBinaBildirimler
                      .filter((item) => item.durum !== 'Kapalı')
                      .map((item) => (
                      <View key={item.id} style={styles.binaBakimArizaCard}>
                        <View style={styles.binaBakimArizaTop}>
                          <Text style={styles.binaBakimArizaKategori}>{item.kategori}</Text>
                          <Text style={styles.binaBakimArizaOncelik}>{item.oncelik}</Text>
                        </View>
                        <Text style={styles.binaBakimArizaKonum}>{item.konum}</Text>
                        <Text style={styles.binaBakimArizaAciklama}>{item.aciklama}</Text>
                        <Text style={styles.binaBakimArizaMeta}>{item.tarih} {item.saat} • {item.bildiren} • Açık</Text>
                      </View>
                    ))
                  )}
                </>
              ) : (
                // Kapananlar - BAKIM'de kapatılan arızalar
                <>
                  {bakimBinaBildirimler.filter((item) => item.durum === 'Kapalı').length === 0 ? (
                    <View style={[styles.formCard, styles.uretimFormCard]}>
                      <Text style={styles.binaBakimEmptyText}>
                        Henüz kapanan arıza kaydı yok.
                      </Text>
                    </View>
                  ) : (
                    bakimBinaBildirimler
                      .filter((item) => item.durum === 'Kapalı')
                      .map((item) => (
                      <View key={item.id} style={[styles.binaBakimArizaCard, { opacity: 0.8 }]}>
                        <View style={styles.binaBakimArizaTop}>
                          <Text style={styles.binaBakimArizaKategori}>{item.kategori}</Text>
                          <Text style={styles.binaBakimArizaOncelik}>{item.oncelik}</Text>
                        </View>
                        <Text style={styles.binaBakimArizaKonum}>{item.konum}</Text>
                        <Text style={styles.binaBakimArizaAciklama}>{item.aciklama}</Text>
                        <Text style={styles.binaBakimArizaMeta}>
                          Açıldı: {item.tarih} {item.saat} • {item.bildiren}
                        </Text>
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ecf0f1' }}>
                          <Text style={[styles.binaBakimArizaMeta, { color: '#27ae60', fontWeight: '600' }]}>
                            ✓ Kapatıldı: {item.kapanisTarih} {item.kapanisSaat}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.uretimBackInlineButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.uretimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
        </View>

        <Text style={styles.bakimTitle}>BAKIM</Text>

        <View style={styles.bakimGrid}>
          <TouchableOpacity 
            style={styles.bakimTile} 
            onPress={() => setCurrentScreen('bakimAktif')}
          >
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

          <TouchableOpacity 
            style={styles.bakimTile}
            onPress={() => setCurrentScreen('bakimHaftalikAna')}
          >
            <Text style={styles.bakimTileTitle}>HAFTALIK BAKIM</Text>
            <Text style={styles.bakimTileSubtitle}>Rutin haftalık bakım</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimBina')}>
            <Text style={styles.bakimTileTitle}>BİNA BAKIM</Text>
            <Text style={styles.bakimTileSubtitle}>Açık iş emirleri</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bakimTile} onPress={() => setCurrentScreen('bakimYardimci')}>
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

  if (currentScreen === 'bakimHaftalikAna') {
    
    const yapilacakBakimlar = haftalikBakimListesi.filter(b => {
      const bugun = new Date();
      const gunNo = bugun.getDay() === 0 ? 6 : bugun.getDay() - 1;
      return b.gun === gunNo && işletmeId === b.işletme_id && b.status !== 'tamamlandi';
    });
    
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
        </View>

        <Text style={styles.bakimTitle}>HAFTALIK BAKIM</Text>

        <View style={styles.bakimTabBar}>
          <TouchableOpacity 
            style={[styles.bakimTab, haftalikTabActive === 'yapilacak' && styles.bakimTabActive]}
            onPress={() => setHaftalikTabActive('yapilacak')}
          >
            <Text style={[styles.bakimTabText, haftalikTabActive === 'yapilacak' && styles.bakimTabTextActive]}>
              YAPILACAK
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bakimTab, haftalikTabActive === 'tamamlanmis' && styles.bakimTabActive]}
            onPress={() => setHaftalikTabActive('tamamlanmis')}
          >
            <Text style={[styles.bakimTabText, haftalikTabActive === 'tamamlanmis' && styles.bakimTabTextActive]}>
              TAMAMLANMIŞ
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
          {haftalikTabActive === 'yapilacak' ? (
            <>
              {yapilacakBakimlar.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Bugün yapılacak bakım yok</Text>
              ) : (
                yapilacakBakimlar.map((bakim) => (
                  <TouchableOpacity
                    key={bakim.id}
                    style={styles.bakimAktifCard}
                    onPress={() => {
                      setSelectedHaftalikBakim(bakim);
                      setHbMakineAdi(bakim.makine_adi || '');
                      setHbGunTarihi(formatCurrentDateIso());
                      setHbBaslangicSaat(bakim.baslangic_saat || '09:00');
                      setHbBitisSaat(bakim.bitis_saat || '16:00');
                      setHbTamamlamaSaati(formatCurrentTime5Min());
                      setHbAciklama('');
                      setHaftalikYapildi(false);
                      setCurrentScreen('bakimHaftalikTamamla');
                    }}
                  >
                    <Text style={styles.bakimAktifMachineText}>
                      {bakim.makine_adi}
                    </Text>
                    <Text style={styles.bakimAktifDescText}>
                      {bakim.baslangic_saat} - {bakim.bitis_saat}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              {haftalikBakimTamamlandi.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Tamamlanan bakım yok</Text>
              ) : (
                haftalikBakimTamamlandi.map((bakim) => (
                  <View key={bakim.id} style={styles.bakimGecmisCard}>
                    <Text style={styles.bakimGecmisDateText}>
                      {bakim.gun_tarihi} {bakim.tamamlama_saati}
                    </Text>
                    <Text style={styles.bakimGecmisMachineText}>
                      {bakim.makine_adi}
                    </Text>
                    <Text style={[styles.bakimGecmisResponseText, {color: '#3a6750', marginTop: 6}]}>
                      {bakim.baslangic_saat} - {bakim.bitis_saat}
                    </Text>
                  </View>
                ))
              )}
            </>
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

  if (currentScreen === 'bakimHaftalikTamamla' && selectedHaftalikBakim) {
    return (
      <View style={styles.bakimDetailContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('bakimHaftalikAna')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bakimTitle}>HAFTALIK BAKIM TAMAMLA</Text>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            ref={bakimDetailScrollRef}
            style={styles.scrollView} 
            contentContainerStyle={styles.bakimDetailScrollContent}
            scrollEnabled={true}
          >
            {/* Makine - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Makine</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{hbMakineAdi}</Text>
              </View>
            </View>

            {/* Tarih - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Gün</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowHbDatePicker(true)}
              >
                <Text style={styles.bakimDetailText}>{hbGunTarihi}</Text>
              </TouchableOpacity>
            </View>

            {/* Başlangıç Saati - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Başlangıç Saati</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowHbBaslangicPicker(true)}
              >
                <Text style={styles.bakimDetailText}>{hbBaslangicSaat}</Text>
              </TouchableOpacity>
            </View>

            {/* Bitiş Saati - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Bitiş Saati</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowHbBitisPicker(true)}
              >
                <Text style={styles.bakimDetailText}>{hbBitisSaat}</Text>
              </TouchableOpacity>
            </View>

            {/* Tamamlama Saati - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Tamamlama Saati</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowHbTamamlamaPicker(true)}
              >
                <Text style={styles.bakimDetailText}>{hbTamamlamaSaati}</Text>
              </TouchableOpacity>
            </View>

            {/* Açıklama */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Açıklama</Text>
              <TextInput 
                style={styles.bakimDetailTextInput}
                placeholder="İş detayları yazınız..."
                placeholderTextColor="#aaa"
                value={hbAciklama}
                onChangeText={setHbAciklama}
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Checkbox - Yapıldı */}
            <View style={[styles.bakimDetailField, {flexDirection: 'row', alignItems: 'center'}]}>
              <TouchableOpacity 
                style={styles.checkbox}
                onPress={() => setHaftalikYapildi(!haftalikYapildi)}
              >
                {haftalikYapildi && <Text style={styles.checkboxMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.bakimDetailLabel}>Yapıldı</Text>
            </View>

            {/* KAYDET Button */}
            <TouchableOpacity
              style={[styles.bakimSaveButton, !haftalikYapildi && {opacity: 0.5}]}
              onPress={() => {
                if (!haftalikYapildi) {
                  Alert.alert('Hata', 'Lütfen "Yapıldı" kutusunu işaretleyin');
                  return;
                }
                haftalikBakimTamamla();
              }}
              disabled={!haftalikYapildi}
            >
              <Text style={styles.bakimSaveButtonText}>KAYDET</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {showHbDatePicker && (
          <DateTimePicker
            value={hbGunTarihi ? new Date(`${hbGunTarihi}T00:00:00`) : new Date()}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowHbDatePicker(false);
              if (selectedDate) {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                setHbGunTarihi(`${year}-${month}-${day}`);
              }
            }}
          />
        )}

        {showHbBaslangicPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowHbBaslangicPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setHbBaslangicSaat(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        {showHbBitisPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowHbBitisPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setHbBitisSaat(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        {showHbTamamlamaPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowHbTamamlamaPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setHbTamamlamaSaati(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('bakimHaftalikAna')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'bakimYillik') {
    const { year: currentYear, week: currentWeek } = getCurrentWeekAndYear();
    
    // 1 hafta sonraki bakımları göster (erken uyarı)
    const yapilacakYillikBakimlar = yillikBakimListesi.filter(b => {
      if (b.işletme_id !== işletmeId || b.status === 'tamamlandi') return false;
      
      // Planın yılı ve hafta aralığını kontrol et
      const planYil = b.yil;
      const planBaslangic = b.baslangic_hafta;
      const planBitis = b.bitis_hafta;
      
      // Eğer bu yıl değilse gösterme
      if (planYil !== currentYear) return false;
      
      // 1 hafta önce bildirim: eğer şu an N. haftadaysak, N+1 hafta ile ilgili planları göster
      const uyariHaftasi = currentWeek + 1;
      
      // Bakım haftası uyarı haftasına denk geliyorsa veya içindeyse göster
      return uyariHaftasi >= planBaslangic && uyariHaftasi <= planBitis;
    });
    
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
        </View>

        <Text style={styles.bakimTitle}>YILLIK BAKIM</Text>

        <View style={styles.bakimTabBar}>
          <TouchableOpacity 
            style={[styles.bakimTab, yillikTabActive === 'yapilacak' && styles.bakimTabActive]}
            onPress={() => setYillikTabActive('yapilacak')}
          >
            <Text style={[styles.bakimTabText, yillikTabActive === 'yapilacak' && styles.bakimTabTextActive]}>
              YAPILACAK
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bakimTab, yillikTabActive === 'tamamlanmis' && styles.bakimTabActive]}
            onPress={() => setYillikTabActive('tamamlanmis')}
          >
            <Text style={[styles.bakimTabText, yillikTabActive === 'tamamlanmis' && styles.bakimTabTextActive]}>
              TAMAMLANMIŞ
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
          {yillikTabActive === 'yapilacak' ? (
            <>
              {yapilacakYillikBakimlar.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Yaklaşan yıllık bakım yok</Text>
              ) : (
                yapilacakYillikBakimlar.map((bakim) => (
                  <TouchableOpacity
                    key={bakim.id}
                    style={styles.bakimAktifCard}
                    onPress={() => {
                      setSelectedYillikBakim(bakim);
                      setYbMakineAdi(bakim.makine_adi || '');
                      setYbYil(String(bakim.yil) || '2026');
                      setYbBaslangicHafta(String(bakim.baslangic_hafta) || '');
                      setYbBitisHafta(String(bakim.bitis_hafta) || '');
                      setYbTamamlamaTarihi(formatCurrentDateIso());
                      setYbTamamlamaSaati(formatCurrentTime5Min());
                      setYbAciklama('');
                      setYillikYapildi(false);
                      setCurrentScreen('bakimYillikTamamla');
                    }}
                  >
                    <Text style={styles.bakimAktifMachineText}>
                      {bakim.makine_adi}
                    </Text>
                    <Text style={styles.bakimAktifDescText}>
                      {bakim.yil} Yıl · {bakim.baslangic_hafta}-{bakim.bitis_hafta}. Hafta
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              {yillikBakimTamamlandi.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Tamamlanan yıllık bakım yok</Text>
              ) : (
                yillikBakimTamamlandi.map((bakim) => (
                  <View key={bakim.id} style={styles.bakimGecmisCard}>
                    <Text style={styles.bakimGecmisDateText}>
                      {bakim.tamamlama_tarihi} {bakim.tamamlama_saati}
                    </Text>
                    <Text style={styles.bakimGecmisMachineText}>
                      {bakim.makine_adi}
                    </Text>
                    <Text style={[styles.bakimGecmisResponseText, {color: '#3a6750', marginTop: 6}]}>
                      {bakim.yil} Yıl · {bakim.baslangic_hafta}-{bakim.bitis_hafta}. Hafta
                    </Text>
                  </View>
                ))
              )}
            </>
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

  if (currentScreen === 'bakimYillikTamamla' && selectedYillikBakim) {
    return (
      <View style={styles.bakimDetailContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('bakimYillik')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bakimTitle}>YILLIK BAKIM TAMAMLA</Text>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            ref={bakimDetailScrollRef}
            style={styles.scrollView} 
            contentContainerStyle={styles.bakimDetailScrollContent}
            scrollEnabled={true}
          >
            {/* Makine - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Makine</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{ybMakineAdi}</Text>
              </View>
            </View>

            {/* Yıl - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Yıl</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{ybYil}</Text>
              </View>
            </View>

            {/* Başlangıç Hafta - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Başlangıç Hafta</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{ybBaslangicHafta}. Hafta</Text>
              </View>
            </View>

            {/* Bitiş Hafta - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Bitiş Hafta</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{ybBitisHafta}. Hafta</Text>
              </View>
            </View>

            {/* Tamamlama Tarihi - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Tamamlama Tarihi</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowYbTamamlamaTarihPicker(true)}
              >
                <Text style={styles.bakimDetailText}>{ybTamamlamaTarihi}</Text>
              </TouchableOpacity>
            </View>

            {/* Tamamlama Saati - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Tamamlama Saati</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowYbTamamlamaSaatPicker(true)}
              >
                <Text style={styles.bakimDetailText}>{ybTamamlamaSaati}</Text>
              </TouchableOpacity>
            </View>

            {/* Açıklama */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Açıklama</Text>
              <TextInput 
                style={styles.bakimDetailTextInput}
                placeholder="Bakım detayları yazınız..."
                placeholderTextColor="#aaa"
                value={ybAciklama}
                onChangeText={setYbAciklama}
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Checkbox - Yapıldı */}
            <View style={[styles.bakimDetailField, {flexDirection: 'row', alignItems: 'center'}]}>
              <TouchableOpacity 
                style={styles.checkbox}
                onPress={() => setYillikYapildi(!yillikYapildi)}
              >
                {yillikYapildi && <Text style={styles.checkboxMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.bakimDetailLabel}>Yapıldı</Text>
            </View>

            {/* KAYDET Button */}
            <TouchableOpacity
              style={[styles.bakimSaveButton, !yillikYapildi && {opacity: 0.5}]}
              onPress={() => {
                if (!yillikYapildi) {
                  Alert.alert('Hata', 'Lütfen "Yapıldı" kutusunu işaretleyin');
                  return;
                }
                yillikBakimTamamla();
              }}
              disabled={!yillikYapildi}
            >
              <Text style={styles.bakimSaveButtonText}>KAYDET</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {showYbTamamlamaTarihPicker && (
          <DateTimePicker
            value={ybTamamlamaTarihi ? new Date(`${ybTamamlamaTarihi}T00:00:00`) : new Date()}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowYbTamamlamaTarihPicker(false);
              if (selectedDate) {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                setYbTamamlamaTarihi(`${year}-${month}-${day}`);
              }
            }}
          />
        )}

        {showYbTamamlamaSaatPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowYbTamamlamaSaatPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setYbTamamlamaSaati(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('bakimYillik')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
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
        </View>
        
        <Text style={styles.bakimTitle}>BİNA BAKIM</Text>
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
          {bakimBinaBildirimler.filter((item) => item.durum !== 'Kapalı').length === 0 ? (
            <Text style={styles.emptyText}>Henüz Bildirim Yok</Text>
          ) : (
            bakimBinaBildirimler
              .filter((item) => item.durum !== 'Kapalı')
              .map((item) => (
              <View key={item.id} style={styles.binaBakimArizaCard}>
                <View style={styles.binaBakimArizaHeader}>
                  <Text style={styles.binaBakimArizaLocation}>{item.konum}</Text>
                  <Text style={[styles.binaBakimArizaCategory, { backgroundColor: item.kategoriRenk || '#95a5a6', color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, fontSize: 12 }]}>
                    {item.kategori}
                  </Text>
                </View>
                <Text style={styles.binaBakimArizaDescription}>{item.aciklama}</Text>
                <View style={styles.binaBakimArizaFooter}>
                  <Text style={[styles.binaBakimArizaPriority, { backgroundColor: item.oncelikRenk || '#95a5a6', color: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 12 }]}>
                    {item.oncelik}
                  </Text>
                  <Text style={styles.binaBakimArizaDate}>{item.tarih} {item.saat}</Text>
                </View>
                <TouchableOpacity
                  style={styles.binaBakimKapatButton}
                  onPress={() => {
                    setBakimBinaBildirimler((prev) =>
                      prev.map((kayit) =>
                        kayit.id === item.id
                          ? {
                              ...kayit,
                              durum: 'Kapalı',
                              kapanisTarih: formatCurrentDateTr(),
                              kapanisSaat: formatCurrentTime5Min(),
                            }
                          : kayit
                      )
                    );
                    Alert.alert('Başarılı', 'Arıza kapatıldı.');
                  }}
                >
                  <Text style={styles.binaBakimKapatButtonText}>KAPAT</Text>
                </TouchableOpacity>
              </View>
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

  if (currentScreen === 'bakimYardimci') {
    const destekSistemleri = [
      { id: 'su', ad: 'Su Tesisatı', ikon: '💧', renk: '#3498db' },
      { id: 'aritma', ad: 'Arıtma', ikon: '🔬', renk: '#2980b9' },
      { id: 'hvac', ad: 'HVAC', ikon: '❄️', renk: '#e74c3c' },
      { id: 'kompresor', ad: 'Kompresör', ikon: '💨', renk: '#c0392b' },
      { id: 'kazan', ad: 'Kazan', ikon: '🔥', renk: '#f39c12' },
    ];

    if (!secilidestekSistemi) {
      // Ana ekran - Sistem seçimi
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
          </View>

          <Text style={styles.bakimTitle}>YARDIMCI İŞLETMELER</Text>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
            {destekSistemleri.map((sistem) => {
              const sistemArızalar = bakimBinaBildirimler.filter(
                (ariza) => ariza.durum !== 'Kapalı' && ariza.kategori === sistem.ad
              );
              return (
                <TouchableOpacity
                  key={sistem.id}
                  style={[styles.bakimAktifCard, { borderLeftColor: sistem.renk, borderLeftWidth: 4 }]}
                  onPress={() => setSecilidestekSistemi(sistem)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 32, marginRight: 12 }}>{sistem.ikon}</Text>
                      <View>
                        <Text style={styles.bakimAktifMachineText}>{sistem.ad}</Text>
                        <Text style={{ fontSize: 12, color: '#7f8c8d', marginTop: 4 }}>
                          {sistemArızalar.length} açık arıza
                        </Text>
                      </View>
                    </View>
                    {sistemArızalar.length > 0 && (
                      <View
                        style={{
                          backgroundColor: '#e74c3c',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                          {sistemArızalar.length}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.bakimBackInlineButton}
            onPress={() => setCurrentScreen('bakim')}
          >
            <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      // Sistem detay - Arızalar listesi
      const sistemArızalar = bakimBinaBildirimler.filter(
        (ariza) => ariza.durum !== 'Kapalı' && ariza.kategori === secilidestekSistemi.ad
      );

      return (
        <View style={styles.bakimAktifContainer}>
          <View style={styles.bakimBackgroundOrbTop} />
          <View style={styles.bakimBackgroundOrbBottom} />

          <View style={styles.bakimHeaderRow}>
            <TouchableOpacity
              style={styles.bakimBackButton}
              onPress={() => setSecilidestekSistemi(null)}
            >
              <Text style={styles.bakimBackButtonText}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bakimTitle}>
            {secilidestekSistemi.ikon} {secilidestekSistemi.ad}
          </Text>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
            {sistemArızalar.length === 0 ? (
              <Text style={styles.bakimAktifEmptyText}>Bu sistem için açık arıza yok</Text>
            ) : (
              sistemArızalar.map((ariza) => (
                <View key={ariza.id} style={styles.binaBakimArizaCard}>
                  <View style={styles.binaBakimArizaHeader}>
                    <Text style={styles.binaBakimArizaLocation}>{ariza.konum}</Text>
                    <Text
                      style={[
                        styles.binaBakimArizaCategory,
                        {
                          backgroundColor: secilidestekSistemi.renk,
                          color: '#fff',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 5,
                          fontSize: 12,
                        },
                      ]}
                    >
                      {ariza.kategori}
                    </Text>
                  </View>
                  <Text style={styles.binaBakimArizaDescription}>{ariza.aciklama}</Text>
                  <View style={styles.binaBakimArizaFooter}>
                    <Text
                      style={[
                        styles.binaBakimArizaPriority,
                        {
                          backgroundColor: ariza.oncelikRenk || '#95a5a6',
                          color: '#fff',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 4,
                          fontSize: 12,
                        },
                      ]}
                    >
                      {ariza.oncelik}
                    </Text>
                    <Text style={styles.binaBakimArizaDate}>{ariza.tarih} {ariza.saat}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.binaBakimKapatButton}
                    onPress={() => {
                      setBakimBinaBildirimler((prev) =>
                        prev.map((kayit) =>
                          kayit.id === ariza.id
                            ? {
                                ...kayit,
                                durum: 'Kapalı',
                                kapanisTarih: formatCurrentDateTr(),
                                kapanisSaat: formatCurrentTime5Min(),
                              }
                            : kayit
                        )
                      );
                      Alert.alert('Başarılı', 'Arıza kapatıldı.');
                    }}
                  >
                    <Text style={styles.binaBakimKapatButtonText}>KAPAT</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.bakimBackInlineButton}
            onPress={() => setSecilidestekSistemi(null)}
          >
            <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  if (currentScreen === 'proje') {
    const devamEdenProjeler = projeListesi.filter(p => {
      const status = getKayitStatus(p);
      return status === 'aktif';
    });

    const tamamlananProjeler = projeTamamlandi;

    return (
      <View style={styles.bakimAktifContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bakimTitle}>PROJE</Text>

        <View style={styles.bakimTabBar}>
          <TouchableOpacity 
            style={[styles.bakimTab, projeTabActive === 'yapilacak' && styles.bakimTabActive]}
            onPress={() => setProjeTabActive('yapilacak')}
          >
            <Text style={[styles.bakimTabText, projeTabActive === 'yapilacak' && styles.bakimTabTextActive]}>
              DEVAM EDİYOR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bakimTab, projeTabActive === 'tamamlanmis' && styles.bakimTabActive]}
            onPress={() => setProjeTabActive('tamamlanmis')}
          >
            <Text style={[styles.bakimTabText, projeTabActive === 'tamamlanmis' && styles.bakimTabTextActive]}>
              TAMAMLANDI
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.bakimAktifScrollContent}>
          {projeTabActive === 'yapilacak' ? (
            <>
              {devamEdenProjeler.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Devam eden proje yok</Text>
              ) : (
                devamEdenProjeler.map((proje) => {
                  const baslangic = proje.baslangic_tarihi ? new Date(proje.baslangic_tarihi) : null;
                  const bitis = proje.bitis_tarihi ? new Date(proje.bitis_tarihi) : null;
                  const bugun = new Date();
                  
                  let yuzde = 0;
                  let kalanGun = 0;
                  if (baslangic && bitis) {
                    const toplamGun = Math.ceil((bitis - baslangic) / (1000 * 60 * 60 * 24));
                    const gecenGun = Math.ceil((bugun - baslangic) / (1000 * 60 * 60 * 24));
                    yuzde = Math.min(Math.max((gecenGun / toplamGun) * 100, 0), 100);
                    kalanGun = Math.max(Math.ceil((bitis - bugun) / (1000 * 60 * 60 * 24)), 0);
                  }

                  return (
                    <TouchableOpacity 
                      key={proje.id} 
                      style={styles.bakimAktifCard}
                      onPress={() => {
                        setSelectedProje(proje);
                        setPProjeAdi(proje.proje_adi || '');
                        setPTamamlamaTarihi(formatCurrentDateIso());
                        setPSonucNotu('');
                        setProjeTamamlandı(false);
                        setCurrentScreen('projeTamamla');
                      }}
                    >
                      <Text style={styles.bakimAktifMachineText}>
                        {proje.proje_adi || 'Proje Adı'}
                      </Text>
                      <Text style={styles.bakimAktifDateText}>
                        {proje.baslangic_tarihi} → {proje.bitis_tarihi}
                      </Text>
                      <Text style={styles.bakimAktifDescText}>
                        Yönetici: {proje.proje_yoneticisi || 'Belirtilmemiş'}
                      </Text>
                      <View style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 12 }}>İlerleme: %{Math.round(yuzde)}</Text>
                          <Text style={{ color: '#fff', fontSize: 12 }}>Kalan: {kalanGun} gün</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#34495e', borderRadius: 3 }}>
                          <View style={{ 
                            width: `${yuzde}%`, 
                            height: '100%', 
                            backgroundColor: '#3498db', 
                            borderRadius: 3 
                          }} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <>
              {tamamlananProjeler.length === 0 ? (
                <Text style={styles.bakimAktifEmptyText}>Tamamlanmış proje yok</Text>
              ) : (
                tamamlananProjeler.map((proje) => (
                  <View key={proje.id} style={styles.bakimAktifCard}>
                    <Text style={styles.bakimAktifMachineText}>
                      {proje.proje_adi || 'Proje Adı'}
                    </Text>
                    <Text style={styles.bakimAktifDateText}>
                      {proje.baslangic_tarihi} → {proje.gercek_bitis_tarihi || proje.bitis_tarihi}
                    </Text>
                    <Text style={styles.bakimAktifDescText}>
                      Yönetici: {proje.proje_yoneticisi || 'Belirtilmemiş'}
                    </Text>
                    {proje.sonuc_notu && (
                      <Text style={[styles.bakimAktifDescText, { marginTop: 4, fontStyle: 'italic' }]}>
                        "{proje.sonuc_notu}"
                      </Text>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'projeTamamla' && selectedProje) {
    return (
      <View style={styles.bakimDetailContainer}>
        <View style={styles.bakimBackgroundOrbTop} />
        <View style={styles.bakimBackgroundOrbBottom} />

        <View style={styles.bakimHeaderRow}>
          <TouchableOpacity
            style={styles.bakimBackButton}
            onPress={() => setCurrentScreen('proje')}
          >
            <Text style={styles.bakimBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bakimTitle}>PROJE TAMAMLA</Text>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.bakimDetailScrollContent}
            scrollEnabled={true}
          >
            {/* Proje Adı - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Proje Adı</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{selectedProje.proje_adi}</Text>
              </View>
            </View>

            {/* Başlangıç Tarihi - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Başlangıç Tarihi</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{selectedProje.baslangic_tarihi}</Text>
              </View>
            </View>

            {/* Planlanan Bitiş Tarihi - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Planlanan Bitiş</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{selectedProje.bitis_tarihi}</Text>
              </View>
            </View>

            {/* Proje Yöneticisi - READONLY */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Proje Yöneticisi</Text>
              <View style={styles.bakimDetailInput_readonly}>
                <Text style={styles.bakimDetailText_readonly}>{selectedProje.proje_yoneticisi}</Text>
              </View>
            </View>

            {/* Gerçek Bitiş Tarihi - Editable */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Gerçek Bitiş Tarihi</Text>
              <TouchableOpacity 
                style={styles.bakimDetailInput}
                onPress={() => setShowPTamamlaDatePicker(true)}
              >
                <Text style={styles.bakimDetailText}>{pTamamlamaTarihi}</Text>
              </TouchableOpacity>
            </View>

            {/* Sonuç Notu */}
            <View style={styles.bakimDetailField}>
              <Text style={styles.bakimDetailLabel}>Sonuç Notu</Text>
              <TextInput 
                style={styles.bakimDetailTextInput}
                placeholder="Proje sonuç ve değerlendirmesi..."
                placeholderTextColor="#aaa"
                value={pSonucNotu}
                onChangeText={setPSonucNotu}
                multiline={true}
                numberOfLines={4}
              />
            </View>

            {/* Checkbox - Tamamlandı */}
            <View style={[styles.bakimDetailField, {flexDirection: 'row', alignItems: 'center'}]}>
              <TouchableOpacity 
                style={styles.checkbox}
                onPress={() => setProjeTamamlandı(!projeTamamlandı)}
              >
                {projeTamamlandı && <Text style={styles.checkboxMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.bakimDetailLabel}>Proje Tamamlandı</Text>
            </View>

            {/* Kaydet Butonu */}
            <TouchableOpacity
              style={styles.bakimDetailSaveButton}
              onPress={projeTamamlayaGonder}
            >
              <Text style={styles.bakimDetailSaveButtonText}>TAMAMLANDIĞINI BİLDİR</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>

        {showPTamamlaDatePicker && (
          <DateTimePicker
            value={new Date(pTamamlamaTarihi)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowPTamamlaDatePicker(false);
              if (selectedDate) {
                setPTamamlamaTarihi(formatDateIso(selectedDate));
              }
            }}
          />
        )}

        <TouchableOpacity
          style={styles.bakimBackInlineButton}
          onPress={() => setCurrentScreen('proje')}
        >
          <Text style={styles.bakimBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'planlama') {
    return (
      <View style={styles.planlamaContainer}>
        <View style={styles.planlamaBackgroundOrbTop} />
        <View style={styles.planlamaBackgroundOrbBottom} />

        <View style={styles.planlamaHeaderRow}>
          <TouchableOpacity
            style={styles.planlamaBackButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Text style={styles.planlamaBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.planlamaTitle}>PLANLAMA</Text>

        <ScrollView contentContainerStyle={styles.planlamaScrollContent}>
          <View style={styles.planlamaGrid}>
            <TouchableOpacity
              style={styles.planlamaTile}
              onPress={() => setCurrentScreen('planlamaYillik')}
            >
              <Text style={styles.planlamaTileTitle}>YILLIK</Text>
              <Text style={styles.planlamaTileSubtitle}>BAKIM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.planlamaTile}
              onPress={() => setCurrentScreen('planlamaHaftalik')}
            >
              <Text style={styles.planlamaTileTitle}>HAFTALIK</Text>
              <Text style={styles.planlamaTileSubtitle}>BAKIM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.planlamaTile}
              onPress={() => setCurrentScreen('planlamaProje')}
            >
              <Text style={styles.planlamaTileTitle}>PROJE</Text>
              <Text style={styles.planlamaTileSubtitle}>PLANLAMASI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.planlamaTile}
              onPress={() => setCurrentScreen('planlamaVeri')}
            >
              <Text style={styles.planlamaTileTitle}>VERİ</Text>
              <Text style={styles.planlamaTileSubtitle}>GİRİŞİ</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.planlamaTileFullWidth}
            onPress={() => setCurrentScreen('planlamaPareto')}
          >
            <Text style={styles.planlamaTileTitle}>PARETO</Text>
            <Text style={styles.planlamaTileSubtitle}>ANALİZİ</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.planlamaBackInlineButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.planlamaBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'planlamaYillik') {
    const yillar = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
    const haftalar = Array.from({length: 52}, (_, i) => String(i + 1));
    
    return (
      <View style={styles.planlamaDetailContainer}>
        <View style={styles.planlamaBackgroundOrbTop} />
        <View style={styles.planlamaBackgroundOrbBottom} />

        <View style={styles.planlamaHeaderRow}>
          <TouchableOpacity
            style={styles.planlamaBackButton}
            onPress={() => setCurrentScreen('planlama')}
          >
            <Text style={styles.planlamaBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.planlamaTitle}>YILLIK BAKIM PLANLAMA</Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.planlamaDetailScrollContent}>
            
            {/* Form Kartı */}
            <View style={styles.planlamaFormCard}>
              <Text style={styles.planlamaFormTitle}>YENİ YILLIK BAKIM PLANI</Text>
              
              {/* Makine Seçimi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Makine</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaYbMakine}
                    onValueChange={(itemValue) => setPlanlamaYbMakine(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    <Picker.Item label="Seçiniz..." value="" />
                    {makineler.map((m, idx) => (
                      <Picker.Item key={idx} label={m} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Yıl Seçimi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Yıl</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaYbYil}
                    onValueChange={(itemValue) => setPlanlamaYbYil(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    {yillar.map((yil, idx) => (
                      <Picker.Item key={idx} label={yil} value={yil} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Başlangıç Hafta */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Başlangıç Hafta (1-52)</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaYbBaslangicHafta}
                    onValueChange={(itemValue) => setPlanlamaYbBaslangicHafta(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    <Picker.Item label="Seçiniz..." value="" />
                    {haftalar.map((hafta, idx) => (
                      <Picker.Item key={idx} label={`${hafta}. Hafta`} value={hafta} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Bitiş Hafta */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Bitiş Hafta (1-52)</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaYbBitisHafta}
                    onValueChange={(itemValue) => setPlanlamaYbBitisHafta(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    <Picker.Item label="Seçiniz..." value="" />
                    {haftalar.map((hafta, idx) => (
                      <Picker.Item key={idx} label={`${hafta}. Hafta`} value={hafta} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* EKLE Butonu */}
              <TouchableOpacity
                style={styles.planlamaAddButton}
                onPress={yillikBakimEkle}
              >
                <Text style={styles.planlamaAddButtonText}>+ EKLE</Text>
              </TouchableOpacity>
            </View>

            {/* Mevcut Planlar Listesi */}
            <View style={styles.planlamaListCard}>
              <Text style={styles.planlamaListTitle}>MEVCUT PLANLAR ({yillikBakimListesi.length})</Text>
              
              {yillikBakimListesi.length === 0 ? (
                <Text style={styles.planlamaEmptyText}>Henüz yıllık bakım planı eklenmemiş</Text>
              ) : (
                yillikBakimListesi.map((bakim) => (
                  <View key={bakim.id} style={styles.planlamaListItem}>
                    <View style={styles.planlamaListItemLeft}>
                      <Text style={styles.planlamaListItemMachine}>{bakim.makine_adi}</Text>
                      <Text style={styles.planlamaListItemDetail}>
                        {bakim.yil} Yıl · {bakim.baslangic_hafta}-{bakim.bitis_hafta}. Hafta
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.planlamaDeleteButton}
                      onPress={() => {
                        Alert.alert(
                          'Silme Onayı',
                          `${bakim.makine_adi} için ${bakim.yil} yılı ${bakim.baslangic_hafta}-${bakim.bitis_hafta}. hafta planı ve tüm tamamlanmış kayıtları silinecek. Emin misiniz?`,
                          [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Sil', style: 'destructive', onPress: () => yillikBakimSil(bakim.id, bakim.makine_adi, bakim.yil, bakim.baslangic_hafta, bakim.bitis_hafta) }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.planlamaDeleteButtonText}>SİL</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        <TouchableOpacity
          style={styles.planlamaBackInlineButton}
          onPress={() => setCurrentScreen('planlama')}
        >
          <Text style={styles.planlamaBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>

      </View>
    );
  }

  if (currentScreen === 'planlamaHaftalik') {
    const gunAdlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    
    return (
      <View style={styles.planlamaDetailContainer}>
        <View style={styles.planlamaBackgroundOrbTop} />
        <View style={styles.planlamaBackgroundOrbBottom} />

        <View style={styles.planlamaHeaderRow}>
          <TouchableOpacity
            style={styles.planlamaBackButton}
            onPress={() => setCurrentScreen('planlama')}
          >
            <Text style={styles.planlamaBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.planlamaTitle}>HAFTALIK BAKIM PLANLAMA</Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.planlamaDetailScrollContent}>
            
            {/* Form Kartı */}
            <View style={styles.planlamaFormCard}>
              <Text style={styles.planlamaFormTitle}>YENİ BAKIM PLANI</Text>
              
              {/* Makine Seçimi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Makine</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaHbMakine}
                    onValueChange={(itemValue) => setPlanlamaHbMakine(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    <Picker.Item label="Seçiniz..." value="" />
                    {makineler.map((m, idx) => (
                      <Picker.Item key={idx} label={m} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Gün Seçimi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Gün</Text>
                <View style={styles.planlamaPickerContainer}>
                  <Picker
                    selectedValue={planlamaHbGun}
                    onValueChange={(itemValue) => setPlanlamaHbGun(itemValue)}
                    style={styles.planlamaPicker}
                  >
                    <Picker.Item label="Seçiniz..." value="" />
                    {gunAdlari.map((gun, idx) => (
                      <Picker.Item key={idx} label={gun} value={String(idx)} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Başlangıç Saati */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Başlangıç Saati</Text>
                <TouchableOpacity 
                  style={styles.planlamaTimeInput}
                  onPress={() => setShowPlanlamaHbBaslangicPicker(true)}
                >
                  <Text style={styles.planlamaTimeText}>{planlamaHbBaslangic}</Text>
                </TouchableOpacity>
              </View>

              {/* Bitiş Saati */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Bitiş Saati</Text>
                <TouchableOpacity 
                  style={styles.planlamaTimeInput}
                  onPress={() => setShowPlanlamaHbBitisPicker(true)}
                >
                  <Text style={styles.planlamaTimeText}>{planlamaHbBitis}</Text>
                </TouchableOpacity>
              </View>

              {/* EKLE Butonu */}
              <TouchableOpacity
                style={styles.planlamaAddButton}
                onPress={haftalikBakimEkle}
              >
                <Text style={styles.planlamaAddButtonText}>+ EKLE</Text>
              </TouchableOpacity>
            </View>

            {/* Mevcut Planlar Listesi */}
            <View style={styles.planlamaListCard}>
              <Text style={styles.planlamaListTitle}>MEVCUT PLANLAR ({haftalikBakimListesi.length})</Text>
              
              {haftalikBakimListesi.length === 0 ? (
                <Text style={styles.planlamaEmptyText}>Henüz haftalık bakım planı eklenmemiş</Text>
              ) : (
                haftalikBakimListesi.map((bakim) => (
                  <View key={bakim.id} style={styles.planlamaListItem}>
                    <View style={styles.planlamaListItemLeft}>
                      <Text style={styles.planlamaListItemMachine}>{bakim.makine_adi}</Text>
                      <Text style={styles.planlamaListItemDetail}>
                        {bakim.gun_adi} · {bakim.baslangic_saat} - {bakim.bitis_saat}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.planlamaDeleteButton}
                      onPress={() => {
                        Alert.alert(
                          'Silme Onayı',
                          `${bakim.makine_adi} için ${bakim.gun_adi} planı ve tüm tamamlanmış kayıtları silinecek. Emin misiniz?`,
                          [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Sil', style: 'destructive', onPress: () => haftalikBakimSil(bakim.id, bakim.makine_adi) }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.planlamaDeleteButtonText}>SİL</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {showPlanlamaHbBaslangicPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowPlanlamaHbBaslangicPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setPlanlamaHbBaslangic(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        {showPlanlamaHbBitisPicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowPlanlamaHbBitisPicker(false);
              if (selectedTime) {
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setPlanlamaHbBitis(`${hours}:${minutes}`);
              }
            }}
          />
        )}

        <TouchableOpacity
          style={styles.planlamaBackInlineButton}
          onPress={() => setCurrentScreen('planlama')}
        >
          <Text style={styles.planlamaBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>

      </View>
    );
  }

  if (currentScreen === 'planlamaProje') {
    return (
      <View style={styles.planlamaDetailContainer}>
        <View style={styles.planlamaBackgroundOrbTop} />
        <View style={styles.planlamaBackgroundOrbBottom} />

        <View style={styles.planlamaHeaderRow}>
          <TouchableOpacity
            style={styles.planlamaBackButton}
            onPress={() => setCurrentScreen('planlama')}
          >
            <Text style={styles.planlamaBackButtonText}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.planlamaTitle}>PROJE PLANLAMA</Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.planlamaDetailScrollContent}>
            
            {/* Form Kartı */}
            <View style={styles.planlamaFormCard}>
              <Text style={styles.planlamaFormTitle}>YENİ PROJE</Text>
              
              {/* Proje Adı */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Proje Adı</Text>
                <TextInput
                  style={styles.planlamaInput}
                  placeholder="Proje adını girin..."
                  placeholderTextColor="#aaa"
                  value={planlamaPProjeAdi}
                  onChangeText={setPlanlamaPProjeAdi}
                />
              </View>

              {/* Başlangıç Tarihi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Başlangıç Tarihi</Text>
                <TouchableOpacity 
                  style={styles.planlamaTimeInput}
                  onPress={() => setShowPlanlamaPBaslangicPicker(true)}
                >
                  <Text style={styles.planlamaTimeText}>{planlamaPBaslangic}</Text>
                </TouchableOpacity>
              </View>

              {/* Bitiş Tarihi (Termin) */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Bitiş Tarihi (Termin)</Text>
                <TouchableOpacity 
                  style={styles.planlamaTimeInput}
                  onPress={() => setShowPlanlamaPBitisPicker(true)}
                >
                  <Text style={styles.planlamaTimeText}>{planlamaPBitis}</Text>
                </TouchableOpacity>
              </View>

              {/* Proje Yöneticisi */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Proje Yöneticisi</Text>
                <TextInput
                  style={styles.planlamaInput}
                  placeholder="Yönetici adını girin..."
                  placeholderTextColor="#aaa"
                  value={planlamaPYoneticisi}
                  onChangeText={setPlanlamaPYoneticisi}
                />
              </View>

              {/* Amaç */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Amaç</Text>
                <TextInput
                  style={[styles.planlamaInput, {height: 80}]}
                  placeholder="Projenin amacını yazınız..."
                  placeholderTextColor="#aaa"
                  value={planlamaPAmac}
                  onChangeText={setPlanlamaPAmac}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              {/* Kapsam */}
              <View style={styles.planlamaField}>
                <Text style={styles.planlamaFieldLabel}>Kapsam</Text>
                <TextInput
                  style={[styles.planlamaInput, {height: 80}]}
                  placeholder="Projeye nelerin dahil olduğunu yazınız..."
                  placeholderTextColor="#aaa"
                  value={planlamaPKapsam}
                  onChangeText={setPlanlamaPKapsam}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              {/* EKLE Butonu */}
              <TouchableOpacity
                style={styles.planlamaAddButton}
                onPress={projeEkle}
              >
                <Text style={styles.planlamaAddButtonText}>+ EKLE</Text>
              </TouchableOpacity>
            </View>

            {/* Mevcut Projeler Listesi */}
            <View style={styles.planlamaListCard}>
              <Text style={styles.planlamaListTitle}>MEVCUT PROJELER ({projeListesi.length})</Text>
              
              {projeListesi.length === 0 ? (
                <Text style={styles.planlamaEmptyText}>Henüz proje eklenmemiş</Text>
              ) : (
                projeListesi.map((proje) => (
                  <View key={proje.id} style={styles.planlamaListItem}>
                    <View style={styles.planlamaListItemLeft}>
                      <Text style={styles.planlamaListItemMachine}>{proje.proje_adi}</Text>
                      <Text style={styles.planlamaListItemDetail}>
                        {proje.baslangic_tarihi} - {proje.bitis_tarihi}
                      </Text>
                      <Text style={[styles.planlamaListItemDetail, {fontSize: 12, color: '#666', marginTop: 4}]}>
                        Yönetici: {proje.proje_yoneticisi}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.planlamaDeleteButton}
                      onPress={() => {
                        Alert.alert(
                          'Silme Onayı',
                          `${proje.proje_adi} projesi silinecek. Emin misiniz?`,
                          [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Sil', style: 'destructive', onPress: () => projeSil(proje.id, proje.proje_adi) }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.planlamaDeleteButtonText}>SİL</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {showPlanlamaPBaslangicPicker && (
          <DateTimePicker
            value={planlamaPBaslangic ? new Date(planlamaPBaslangic) : new Date()}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowPlanlamaPBaslangicPicker(false);
              if (selectedDate) {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                setPlanlamaPBaslangic(`${year}-${month}-${day}`);
              }
            }}
          />
        )}

        {showPlanlamaPBitisPicker && (
          <DateTimePicker
            value={planlamaPBitis ? new Date(planlamaPBitis) : new Date()}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowPlanlamaPBitisPicker(false);
              if (selectedDate) {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                setPlanlamaPBitis(`${year}-${month}-${day}`);
              }
            }}
          />
        )}

        <TouchableOpacity
          style={styles.planlamaBackInlineButton}
          onPress={() => setCurrentScreen('planlama')}
        >
          <Text style={styles.planlamaBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>

      </View>
    );
  }

  if (currentScreen === 'planlamaVeri') {
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
              onPress={() => setCurrentScreen('planlama')}
            >
              <Text style={styles.veriGirisBackButtonText}>‹</Text>
            </TouchableOpacity>
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
          onPress={() => setCurrentScreen('planlama')}
        >
          <Text style={styles.veriGirisBackInlineText}>‹ GERİ</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'planlamaPareto') {
    return (
      <View style={styles.container}>
        <Text style={styles.baslik}>PLANLAMA - PARETO ANALİZİ</Text>
        <Text style={styles.emptyText}>Yapım aşamasında...</Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: '#95a5a6' }]}
          onPress={() => setCurrentScreen('planlama')}
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
  hamburgerButton: {
    position: 'absolute',
    top: 52,
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hamburgerIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
  sideMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  sideMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sideMenuPanel: {
    width: 280,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  sideMenuHeader: {
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideMenuAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sideMenuAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f4ea8',
  },
  sideMenuUserInfo: {
    flex: 1,
  },
  sideMenuUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  sideMenuUserEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  sideMenuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  sideMenuItems: {
    flex: 1,
    paddingVertical: 8,
  },
  sideMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sideMenuItemIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  sideMenuItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  sideMenuItemDanger: {
    backgroundColor: '#fef2f2',
  },
  sideMenuItemTextDanger: {
    fontSize: 15,
    color: '#dc2626',
    fontWeight: '600',
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
    borderWidth: 0,
  },
  menuHeaderTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  menuHeaderSubtitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
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
  binaBakimTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  binaBakimTabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  binaBakimTabButtonActive: {
    backgroundColor: '#ffffff',
  },
  binaBakimTabText: {
    color: '#dbeafe',
    fontSize: 14,
    fontWeight: '700',
  },
  binaBakimTabTextActive: {
    color: '#1e3a8a',
  },
  binaBakimListWrap: {
    marginTop: 2,
  },
  binaBakimEmptyText: {
    color: '#244e72',
    fontSize: 15,
    textAlign: 'center',
  },
  binaBakimArizaCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#d7e3f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  binaBakimArizaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  binaBakimArizaKategori: {
    color: '#1f2a44',
    fontSize: 16,
    fontWeight: '800',
  },
  binaBakimArizaOncelik: {
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '700',
  },
  binaBakimArizaKonum: {
    color: '#334155',
    marginTop: 6,
    fontWeight: '700',
  },
  binaBakimArizaAciklama: {
    color: '#475569',
    marginTop: 6,
    lineHeight: 20,
  },
  binaBakimArizaMeta: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  binaBakimKapatButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1f2a44',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  binaBakimKapatButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
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
    position: 'absolute',
    right: 14,
    bottom: Platform.OS === 'android' ? 56 : 20,
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
  bakimTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  bakimTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  bakimTabActive: {
    borderBottomColor: '#ffffff',
  },
  bakimTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(248, 250, 252, 0.6)',
  },
  bakimTabTextActive: {
    color: '#ffffff',
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
  bakimDetailContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  bakimDetailScrollContent: {
    paddingBottom: 120,
  },
  bakimDetailField: {
    marginBottom: 12,
  },
  bakimDetailLabel: {
    color: '#f8fbff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  bakimDetailInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6e2f1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bakimDetailInput_readonly: {
    backgroundColor: '#e8f0fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c5d6ee',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bakimDetailText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2a44',
  },
  bakimDetailText_readonly: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2a44',
  },
  bakimDetailTextInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6e2f1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 76,
    fontSize: 15,
    color: '#1f2a44',
    textAlignVertical: 'top',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d6e2f1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxMark: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a44',
    lineHeight: 18,
  },
  bakimSaveButton: {
    backgroundColor: '#14b86a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  bakimSaveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
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
  planlamaContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  planlamaBackgroundOrbTop: {
    position: 'absolute',
    top: -84,
    left: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(143, 217, 248, 0.24)',
  },
  planlamaBackgroundOrbBottom: {
    position: 'absolute',
    bottom: -90,
    right: -65,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(125, 205, 240, 0.2)',
  },
  planlamaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planlamaBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planlamaBackButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  planlamaAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planlamaAvatarText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  planlamaTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fbff',
    marginBottom: 14,
  },
  planlamaScrollContent: {
    paddingBottom: 80,
  },
  planlamaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planlamaTile: {
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
  planlamaTileFullWidth: {
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
  planlamaTileTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f4ea8',
    textAlign: 'center',
  },
  planlamaTileSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a85da',
    textAlign: 'center',
    marginTop: 4,
  },
  planlamaBackInlineButton: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 56 : 20,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2a44',
  },
  planlamaBackInlineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  planlamaDetailContainer: {
    flex: 1,
    backgroundColor: '#0f4ea8',
    paddingHorizontal: 14,
    paddingTop: 56,
    position: 'relative',
  },
  planlamaDetailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  planlamaFormCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  planlamaFormTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f4ea8',
    marginBottom: 20,
    textAlign: 'center',
  },
  planlamaField: {
    marginBottom: 16,
  },
  planlamaFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  planlamaInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  planlamaPickerContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  planlamaPicker: {
    height: 50,
    color: '#1e293b',
  },
  planlamaTimeInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planlamaTimeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  planlamaAddButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  planlamaAddButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  planlamaListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  planlamaListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  planlamaEmptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  planlamaListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  planlamaListItemLeft: {
    flex: 1,
  },
  planlamaListItemMachine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  planlamaListItemDetail: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  planlamaDeleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 10,
  },
  planlamaDeleteButtonText: {
    color: '#ffffff',
    fontSize: 12,
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

