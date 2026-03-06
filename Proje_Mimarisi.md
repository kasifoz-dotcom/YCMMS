# Proje Yonetimi Mimarisi

## 1) Planlama > Proje (planlamaProje ekrani)
**Amac:**
- Yeni proje plani olusturmak
- Mevcut projeleri listelemek ve silmek

**Form Alanlari:**
- Proje Adi
- Baslangic Tarihi
- Bitis Tarihi (Termin)
- Proje Yoneticisi
- Amac
- Kapsam

**Buton: `+ EKLE`**
- Fonksiyon: `projeEkle()`
- Firestore collection: `projeler`

**Yazilan alanlar:**
- `proje_adi`
- `baslangic_tarihi`
- `bitis_tarihi`
- `proje_yoneticisi`
- `amac`
- `kapsam`
- `isletme_id`
- `isletme_kimligi`
- `olusturma_tarihi`
- `status = aktif`
- `durum = aktif`

**Listeleme kaynagi:**
- `projeListesi` (`projeYukle()` ile dolar)
- Filtre: ilgili isletme + `onay_bekliyor` olmayanlar

**Buton: `SIL`**
- Fonksiyon: `projeSil(projeId, projeAdi)`
- Islem:
  - `projeler/{projeId}` silinir
  - bagli kayitlar temizlenir:
    - `projeButce` (`proje_id == projeId`)
    - `projeRisk` (`proje_id == projeId`)

## 2) Ana Menu > Proje (proje ekrani)
**Amac:**
- Proje operasyon ekrani
- Iki sekme:
  - `DEVAM EDIYOR`
  - `TAMAMLANDI`

### Devam Ediyor sekmesi
- Kaynak: `projeListesi`
- Filtre: `status/durum == aktif`
- Kartta gosterilen:
  - Proje adi
  - Baslangic -> Bitis
  - Yonetici
  - Ilerleme yuzdesi
  - Kalan gun

**Kart tiklama:**
- Ekran: `projeTamamla`
- Hazirlanan state:
  - `selectedProje`
  - `pProjeAdi`
  - `pTamamlamaTarihi`
  - `pSonucNotu`
  - `projeTamamlandi`

### Tamamlandi sekmesi
- Kaynak: `projeTamamlandi`
- Gosterim:
  - Proje adi
  - Baslangic -> Gercek bitis (veya plan bitis)
  - Yonetici
  - Sonuc notu (varsa)

## 3) Proje Tamamla (projeTamamla ekrani)
**Amac:**
- Devam eden projeyi tamamlamaya gondermek

**Readonly alanlar:**
- Proje Adi
- Baslangic Tarihi
- Planlanan Bitis
- Proje Yoneticisi

**Editable alanlar:**
- Gercek Bitis Tarihi
- Sonuc Notu
- Checkbox: Proje Tamamlandi

**Buton: `TAMAMLANDIGINI BILDIR`**
- Fonksiyon: `projeTamamlayaGonder()`

**Kontrol kurallari:**
- `pProjeAdi` dolu olmali
- `pSonucNotu` dolu olmali
- `projeTamamlandi` true olmali

## 4) `projeTamamlayaGonder()` veri akisi
### A) Tamamlama kaydi olusturur
- Collection: `projeTamamlandi`
- Alanlar:
  - `proje_adi`
  - `baslangic_tarihi`
  - `termin_tarihi`
  - `gercek_bitis_tarihi`
  - `proje_yoneticisi`
  - `amac`
  - `kapsam`
  - `sonuc_notu`
  - `yapan_kisi`
  - `isletme_id`
  - `isletme_kimligi`
  - `olusturma_tarihi`

### B) Plan status gunceller
- Collection: `projeler`
- Doc: `selectedProje.id`
- Guncellenen alanlar:
  - `status = onay_bekliyor`
  - `durum = onay_bekliyor`

### C) Sonra listeleri yeniler
- `projeYukle()`
- `projeTamamlandiYukle()`
- `projeOnayBekliyorYukle()`

## 5) Onay sureci (hazir fonksiyonlar)
### `projeOnayla(projeId)`
- `projeler/{projeId}` update:
  - `status = tamamlandi`
  - `durum = tamamlandi`
  - `onay_tarihi`
  - `onaylayan`

### `projeReddet(projeId)`
- `projeler/{projeId}` update:
  - `status = aktif`
  - `durum = aktif`
  - `red_tarihi`
  - `redjeden`

## 6) Status state machine
```text
aktif
  -> onay_bekliyor
     -> tamamlandi
     -> (reddedilirse) aktif
```

## 7) Teknik notlar
- Uyumluluk yardimcilari:
  - `getKayitStatus()` -> `status` veya `durum`
  - `getKayitIsletmeId()` -> isletme alan fallback
- Not:
  - `setCurrentScreen('bakimProjesi')` cagrisi tanimli route ile tutarlilik acisindan tekrar kontrol edilmelidir.
