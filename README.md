# Mafia Playing

Aplikacja do prowadzenia gry w Mafię bez kont. Host tworzy pokój, dostaje kod, gracze dołączają nickiem, a role są losowane po starcie gry.

## Uruchomienie lokalnie

1. Skopiuj `.env.example` do `.env.local`.
2. Ustaw `MONGODB_URI` i opcjonalnie `MONGODB_DB`.
3. Zainstaluj zależności:

```bash
npm install
```

4. Uruchom:

```bash
npm run dev
```

## Deploy na Vercel

W Vercel dodaj zmienne środowiskowe:

- `MONGODB_URI`
- `MONGODB_DB` opcjonalnie, domyślnie `mafia_playing`

Potem podłącz repozytorium i deployuj jako standardową aplikację Next.js.
