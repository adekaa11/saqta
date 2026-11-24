# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Protected member (primary, check screen):** people 55+ in Kazakhstan's regions (example persona: Гүлнар апа, Шымкент). Kazakh by default, Russian as a switch; often mixed speech. Uses a phone, weak eyesight, little app experience. Situation: just got a call or WhatsApp message "from Kaspi / 1414 / eGov / police" asking for an SMS code or a transfer, and is unsure and anxious.
- **Guardian (family dashboard):** the adult son or daughter living in another city (example persona: Ержан, Алматы). Job: learn immediately when a parent meets a scam or presses SOS, and call them.

## Product Purpose

Saqta (каз. «сақта» — «сохрани») is a family shield against phone and messenger fraud. The parent retells a call by voice, pastes or forwards a message, or presses SOS. Within seconds they get a verdict (risk 0–100, scheme type, the exact manipulation phrases highlighted with plain explanations, what to do). If it is a scam, or on SOS, the guardian gets a live alert. Success: the parent does not dictate the code or transfer money, and the family hears about it before the money is gone.

## Positioning

Banks' antifraud sees the transaction when money is already leaving; operators block numbers; caller-ID apps judge the number, not the content. Saqta analyses what was actually said, before any transfer, in Kazakh/Russian/mixed speech, and puts the trusted family member, not the bank, into the loop.

## Operating Context

- Built for SPARK Hackathon round 1 (idea evaluation): the prototype mainly serves a ≤5-minute video demo and judges' Q&A. Demo path: voice retell → 94/100 verdict with highlighted tricks → live alert on the son's screen; SOS shown as a second scenario.
- In the real product the main channel is a WhatsApp/Telegram bot; the web app is the family cabinet and demo showcase.

## Capabilities and Constraints

- Stack: Vite + React + Tailwind + framer-motion, deployed on Vercel; mock mode by default, FastAPI backend per API contract (../PLAN.md).
- Two screens in scope: Check (`#/check`) and Family (`#/family`). Radar and scheme catalog exist only on slides.
- Voice via browser Web Speech API with a scripted demo fallback (`?demo=1`).
- Terminology: verdicts АЛАЯҚТАР / КҮДІКТІ / ҚАУІПСІЗ; flag types authority, urgency, sms_code, safe_account, remote_access, link, too_good, personal_data, payment_request.

## Brand Commitments

- Name: **Saqta**. Nothing else is fixed (no mandated colors, logo, or ornament).

## Evidence on Hand

- Real public statistics with sources in ../PLAN.md (≈29–30k internet-fraud cases in 2025; 12.2 bn ₸ damage per Prosecutor General).
- All family members, alerts, radar numbers in the prototype are synthetic demo data. No real users, testimonials, partners, or pricing exist; do not invent them.

## Product Principles

1. Calm the person first, then inform: the verdict must be readable in one glance by an anxious 70-year-old.
2. Show the trick, don't just score it: every verdict points at the exact words that were manipulative.
3. Family over institutions: the most important action is always "call your son / your mother".
4. Kazakh first, never machine-cold: language and tone of a relative, not a bank.

## Accessibility & Inclusion

- Elderly users: large type (body ≥18px on the check screen), big tap targets, high contrast, no reliance on color alone for verdicts, no small gray text for essential info.
- Bilingual KK/RU; Kazakh-specific letters (ә ғ қ ң ө ұ ү һ і) must render in the chosen fonts.
