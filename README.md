# info**4**invo 🧾

> AI-powered invoice intelligence & bank reconciliation platform — built for the **AIT Makeathon 2026**.

---

## Τι είναι το info4invo;

Το **info4invo** είναι μια web εφαρμογή που επιτρέπει σε επιχειρήσεις να ανεβάζουν τιμολόγια (PDF/εικόνες), να τα αναλύουν αυτόματα με AI και να τα ερωτούν σε φυσική γλώσσα — ακριβώς σαν να μιλάνε με έναν έξυπνο λογιστή. Το σύστημα επίσης εκτελεί αυτόματη **Bank Reconciliation**, αντιστοιχίζοντας κάθε τιμολόγιο με τις αντίστοιχες τραπεζικές συναλλαγές.

---

## ✨ Χαρακτηριστικά

- **📤 Μαζικό Ανέβασμα Τιμολογίων** — Υποστήριξη πολλαπλών αρχείων (PDF, PNG, JPG/JPEG) σε ένα βήμα
- **🤖 AI Εξαγωγή Δεδομένων** — Χρήση GPT-4o μέσω Azure OpenAI για αυτόματη αναγνώριση κειμένου, ποσών, ημερομηνιών και προμηθευτών
- **🔍 Σημασιολογική Αναζήτηση (RAG)** — Ερωτήσεις σε φυσική γλώσσα πάνω στα αποθηκευμένα τιμολόγια μέσω vector embeddings
- **🏦 Bank Reconciliation** — Αυτόματη αντιστοίχιση τιμολογίων με τραπεζικές εγγραφές (CSV statement)
- **🗓️ Ημερολόγιο Εγγράφων** — Οπτική ταξινόμηση ανεβασμένων αρχείων ανά ημερομηνία
- **📸 Zoom Preview** — Ευφυής εστίαση στο σχετικό τμήμα του τιμολογίου κατά την απάντηση
- **📝 Σημειώσεις Παρουσίασης** — Scratchpad για γρήγορες σημειώσεις μέσα στην εφαρμογή

---

## 🏗️ Αρχιτεκτονική

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                  │
│           (React 19 + Tailwind CSS v4)              │
└────────────┬──────────────────┬────────────────────-┘
             │                  │
     ┌───────▼──────┐   ┌───────▼──────────┐
     │  /api/upload │   │   /api/chat      │
     │  Route       │   │   Route          │
     └───────┬──────┘   └───────┬──────────┘
             │                  │
     ┌───────▼──────────────────▼──────────┐
     │         Azure OpenAI (GPT-4o)       │
     │   OCR extraction + Embeddings       │
     └───────┬──────────────────┬──────────┘
             │                  │
     ┌───────▼──────┐   ┌───────▼──────────┐
     │   Supabase   │   │    Supabase      │
     │   Storage    │   │ pgvector (RAG)   │
     │  (εικόνες)   │   │  (embeddings)    │
     └──────────────┘   └──────────────────┘
```

### Ροή Ανεβάσματος (`/api/upload`)
1. Λήψη εικόνας ως base64
2. Αποθήκευση αρχείου στο **Supabase Storage** bucket `documents`
3. Εξαγωγή κειμένου με **GPT-4o** (vision)
4. Δημιουργία **vector embedding** με `text-embedding-3-small`
5. Αποθήκευση content, embedding και public URL στη βάση δεδομένων

### Ροή Ερώτησης (`/api/chat`)
1. Δημιουργία embedding για την ερώτηση του χρήστη
2. **Semantic search** στη Supabase (pgvector `match_documents`)
3. Δόμηση prompt με context + εικόνα τιμολογίου
4. **GPT-4o** παράγει JSON απάντηση με: κείμενο, zoom coordinates, reconciliation
5. Bank reconciliation έναντι virtual CSV statement

---

## 🚀 Εγκατάσταση & Εκκίνηση

### Προαπαιτούμενα

- Node.js 18+
- Λογαριασμός [Supabase](https://supabase.com)
- Azure OpenAI resource με deployments για `gpt-4o` και `text-embedding-3-small`

### 1. Κλωνοποίηση & εγκατάσταση

```bash
git clone <repository-url>
cd makeathon-2026-ait_team-info4invo
npm install
```

### 2. Μεταβλητές περιβάλλοντος

Δημιουργήστε αρχείο `.env.local` στη ρίζα του project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

AZURE_OPENAI_API_KEY=<your-azure-openai-key>
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

### 3. Ρύθμιση Supabase

Δημιουργήστε τον πίνακα `documents` με pgvector στη Supabase:

```sql
-- Ενεργοποίηση pgvector extension
create extension if not exists vector;

-- Δημιουργία πίνακα
create table documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Δημιουργία συνάρτησης similarity search
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
```

Δημιουργήστε επίσης ένα **Storage bucket** με όνομα `documents` (public).

### 4. Εκκίνηση

```bash
npm run dev
```

Ανοίξτε [http://localhost:3000](http://localhost:3000).

---

## 📁 Δομή Αρχείων

```
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts       # RAG + Bank Reconciliation API
│   │   └── upload/
│   │       └── route.ts       # Ανέβασμα & vectorization τιμολογίων
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Κύρια UI (chat + sidebar + calendar)
├── public/
├── package.json
├── next.config.ts
└── tsconfig.json
```

---

## 🛠️ Τεχνολογίες

| Κατηγορία | Τεχνολογία |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| AI / LLM | Azure OpenAI — GPT-4o, text-embedding-3-small |
| Βάση δεδομένων | Supabase (PostgreSQL + pgvector) |
| Αποθήκευση | Supabase Storage |
| Γλώσσα | TypeScript |

---

## 👥 Ομάδα

**Team info4invo** — AIT Makeathon 2026
