# FoodLoop

**From Surplus to Supper in Under 60 Minutes.**

FoodLoop is a full-stack MVP for redistributing surplus meals from food businesses to approved NGOs and volunteers. It also supports NGO-verified community food needs, one-time QR pickup confirmation, donation certificates, impact reporting, a leaderboard, and a synthetic-data surplus prediction demo.

## What is implemented

- Responsive React/Vite landing page and separate Donor, NGO, Volunteer, and Admin dashboards.
- Persistent SQLite accounts, Argon2 password hashing, bearer-token authentication, and role-based API access.
- Donor food listings with safety checklist, image upload, pickup deadline, and address/location privacy.
- Approved-NGO-only, atomic donation claiming; expired donations cannot be claimed.
- Volunteer authorization, one-time QR pickup verification, and PDF certificates after confirmed pickup.
- Community need reports hidden from donors until verified by an approved NGO; meal pledges and distribution tracking.
- Leaflet/OpenStreetMap map, impact overview, verified-donation leaderboard, notifications, and ratings.
- Random Forest surplus prediction trained on generated synthetic demo data.
- Admin tools for NGO approval/rejection, user account status, and community report review.

## Architecture

```text
Browser
  └── React + Vite + Tailwind (http://localhost:5173)
        ├── React Router, Axios, Recharts, Leaflet/OpenStreetMap
        └── /api requests → Vite development proxy
              └── FastAPI + SQLAlchemy (http://127.0.0.1:8000)
                    ├── JWT authentication and role-based REST routers
                    ├── SQLite database: backend/data/foodloop.db
                    ├── Local uploads: backend/uploads/
                    ├── QR pickup verification and PDF certificates
                    └── Scikit-learn Random Forest demo prediction
```

## Folder structure

```text
FoodLoop/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # Auth, donations, admin, pickup, community, ML, analytics, activity
│   │   ├── core/             # Settings, password hashing, JWT helpers
│   │   ├── db/               # SQLAlchemy base and sessions
│   │   ├── models/           # User, donation, community, activity models
│   │   ├── schemas/          # API request and response validation
│   │   └── scripts/          # Admin bootstrap and demo data
│   ├── tests/                # End-to-end API workflow test
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios API client
│   │   ├── auth/             # Authentication/session provider
│   │   ├── components/       # Donation, impact, community, map, admin UI
│   │   └── pages/            # Landing, login/register, dashboards
│   └── package.json
├── .env.example
├── pytest.ini
└── README.md
```

## Requirements

- Windows 10/11
- Python 3.10 or later (the included virtual environment is project-local)
- Node.js 20.19+ or 22.12+
- npm
- Internet access for OpenStreetMap tiles

SQLite is included with Python; you do not need to install or run a separate database server.

## Setup and run in VS Code

Open the FoodLoop folder in VS Code. These commands are for the VS Code integrated **Command Prompt** terminal (not PowerShell). Run backend and frontend in two separate terminals. The commands below assume each terminal starts in the project root.

### 1. Configure and install the backend

```bat
copy .env.example .env
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If `backend\.venv\Scripts\python.exe` does not exist yet, create the environment first:

```bat
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

For stable development logins, set `JWT_SECRET_KEY` in `.env` to a random value of at least 32 characters. To generate a value with Node.js:

```bat
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the printed value after `JWT_SECRET_KEY=` in `.env`. A temporary key is used when the setting is blank, which invalidates existing sessions after a backend restart. Production requires a configured secret.

### 2. Start the backend

From the project root:

```bat
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open. The API is at `http://127.0.0.1:8000`, interactive API docs are at `http://127.0.0.1:8000/docs`, and the health check is at `http://127.0.0.1:8000/api/health`.

### 3. Install and start the frontend

Open a second integrated terminal in the project root:

```bat
cd frontend
npm install
npm run dev
```

Keep this terminal open and open the Vite URL, normally `http://localhost:5173`. Vite forwards `/api` requests to the backend.

## Optional demo data

To load sample donor, NGO, volunteer, and admin accounts plus clearly labeled sample listings and needs, open another terminal:

```bat
cd backend
..\.venv\Scripts\python.exe -m app.scripts.seed_demo
```

The seed operation is safe to repeat and preserves existing accounts. Demo credentials:

| Role | Email |
|---|---|
| Donor | `donor@foodloop.demo` |
| NGO (approved) | `ngo@foodloop.demo` |
| Volunteer | `volunteer@foodloop.demo` |
| Admin | `admin@foodloop.demo` |

The demo password is `FoodLoopDemo2026!`. These shared credentials are for a local demonstration only; do not use them in a public or production deployment. To create a separate admin account, run `cd backend` and then `.venv\Scripts\python.exe -m app.scripts.create_admin`; the script prompts for credentials without putting the password in shell history.

## Suggested demo walkthrough

1. Sign in as the admin and approve a newly registered NGO from the Admin dashboard.
2. Sign in as the donor and publish a donation after completing every food safety item.
3. Sign in as the approved NGO and claim the donation. A second NGO cannot claim the same listing.
4. As the NGO, select an authorized volunteer and generate the pickup QR code.
5. As that volunteer, confirm pickup with the QR token. Reusing the token is rejected; the completed donation can then produce a PDF certificate.
6. Submit a community need as a volunteer. It remains hidden from donors until an approved NGO verifies it.
7. As a donor, pledge meals to a verified need; as an NGO, update the pledge's distribution status.
8. Explore the map, impact overview, leaderboard, notifications, ratings, and surplus prediction panel.

## Verify the project

Run these from the project root:

```bat
backend\.venv\Scripts\python.exe -m pytest -q
backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\tests
npm --prefix frontend run build
```

The workflow test covers safety validation, NGO approval and claiming, approximate volunteer location visibility, QR authorization and single-use confirmation, PDF certificate output, private-to-verified community needs, pledges, ML prediction/history, and analytics.

## API overview

All endpoints are under `/api`. Protected routes require `Authorization: Bearer <access_token>`.

| Area | Routes |
|---|---|
| Health/auth | `GET /health`; `POST /auth/register`; `POST /auth/login`; `GET /auth/me` |
| Donations | `POST /donations`; `GET /donations`; `GET/PUT/DELETE /donations/{id}`; `POST /donations/{id}/claim`; `POST /donations/images` |
| Pickup | `GET /verification/volunteers`; `POST /verification/generate/{donation_id}`; `PUT /verification/authorize/{donation_id}`; `POST /verification/confirm`; `GET /verification/certificates/{donation_id}` |
| Community | `POST /community/reports`; `GET /community/verified`; `GET /community/reports/mine`; verify reports, create pledges, and update distribution under `/community` |
| ML/impact | `POST /ml/predict`; `GET /ml/history`; `GET /analytics/overview`; `GET /leaderboard?period=weekly\|monthly\|yearly` |
| Admin | NGO approval/rejection, user listing/status management, community report review under `/admin` |
| Activity | `GET /notifications`; `PUT /notifications/{id}/read`; `POST /donations/{donation_id}/ratings` |

The complete request and response schemas are available at `http://127.0.0.1:8000/docs`.

## MVP limitations and safety notes

- Random Forest predictions use generated synthetic training records, not real restaurant history. Treat output as a demonstration, not an operational forecast.
- Impact conversion values (for example meals to kilograms and CO2) are illustrative estimates, not audited measurements.
- Community report forms instruct users not to include identifiable faces; the MVP does not automatically detect or blur faces.
- The map uses OpenStreetMap tiles and shows approximate coordinates to protect location privacy. It requires internet access for map tiles.
- Uploaded images are validated for allowed image format and file size but are stored locally; production deployment should use private object storage, backups, rate limits, and malware scanning.
- Email verification, password reset, production-grade monitoring, and deployment hardening are outside this hackathon MVP.
- Food safety checklist completion is a user attestation, not a substitute for local food-safety rules or professional inspection.
