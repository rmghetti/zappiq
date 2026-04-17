# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — Onda P0 (Pre-Launch) — 2026-04-17

### Added
- **P0-04** `feat(web)`: Standalone `/precos` page resolving sitemap 404 — `19edf88`
- **P0-09** `feat(web)`: LGPD-compliant granular cookie consent banner with backward-compatible API — `d04516e`
- **P0-10** `feat(database,api)`: RLS multi-tenant isolation across 16 tables + Express middleware — `e434024`
- **P0-11** `feat(rag)`: Fly.io deploy config (`fly.toml`) and setup script for RAG service (GRU region) — `1fc02d4`
- **P0-12** `feat(rag)`: OpenTelemetry traces and metrics in RAG service (completes backend coverage) — `66faf5d`
- **P0-13** `feat(ci)`: Full CI pipeline (lint, type-check, audit, Prisma validate) + expanded deploy workflow (API + RAG + migrate) — `0d87dab`
- **P0-15** `feat(web)`: Premium landing page — trust signals, Programa Fundadores, honest content — `3b41089`

### Changed
- **P0-01** `feat(web)`: All public pages consume `planConfig.ts` as single source of truth for pricing (247/797/1697/3997) — `10f7ef8`
- **P0-02** `feat(web,api)`: Trial period unified from 21 days to 14 days across all surfaces — `640861c`
- **P0-14** `feat(scripts)`: Smoke tests expanded to 6 critical endpoints with CI-compatible exit codes — `042e9af`

### Fixed
- **P0-03** `fix(web)`: Replaced inflated vanity metrics with honest pre-launch data — `076736f`
- **P0-05** `fix(web)`: Replaced fictional case studies with honest segment-based `/cases` page — `436c3e5`
- **P0-06** `fix(web)`: Replaced placeholder WhatsApp number with real number (+55 11 94563-3305) — `447a3cc`
- **P0-07** `fix(web)`: Replaced `#META_PARTNER_URL` placeholder with real Meta partner directory URL — `2a04313`
- **P0-08** `fix(web)`: Footer updated with full legal info (CNPJ, CENU address, DPO contact) — `5886f6d`
