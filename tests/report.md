# Automated Test Report

Start: 2026-05-13T02:27:13.299Z
End: 2026-05-13T02:27:38.490Z

## Steps

- Opened jimpitan page
- Enabled admin via localStorage and reloaded
- Filled jimpitan entry form
- Intercepted call to https://script.google.com/macros/s/AKfycbwx9SAlhLZnSM8V43sIJpf84B28-x6ErVQTOInKU1ZGoabTXZKWQOTftjViMuxuM62E/exec
- Captured payload: {"action":"addItem","tanggal":"13-Mei-2026","tipe":"Pemasukan","nominal":12345,"keterangan":"Automated test","password":"adminbn2","source":"jimpitan"}
- Submitted jimpitan entry (mocked)
- Optimistic UI shows new entry: yes
- Opened inventaris page
- Inventory items on page: 1
- Service worker registrations: {"registered":true,"count":2}

## Console (last 20)

```json
[
  {
    "type": "error",
    "text": "Fetch error: TypeError: Failed to fetch\n    at fetchData (http://127.0.0.1:3000/jimpitan/app.js?v=1.8:119:36)\n    at HTMLDocument.init (http://127.0.0.1:3000/jimpitan/app.js?v=1.8:52:33)"
  }
]
```

## Errors

```json
[]
```

## Failed Requests

```json
[
  {
    "url": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=289431951&single=true&output=csv&t=1778639238507",
    "err": "net::ERR_ABORTED"
  }
]
```