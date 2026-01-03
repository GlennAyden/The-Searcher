import requests

URLS = [
    "https://id.wikipedia.org/wiki/Daftar_perusahaan_yang_tercatat_di_Bursa_Efek_Indonesia",
    "https://id.wikipedia.org/wiki/Daftar_emiten_di_Bursa_Efek_Indonesia",
    "https://en.wikipedia.org/wiki/IDX_Composite", # Might have a list?
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

for url in URLS:
    try:
        r = requests.get(url, headers=HEADERS, timeout=5)
        print(f"{r.status_code} : {url}")
    except Exception as e:
        print(f"ERR : {url} - {e}")
