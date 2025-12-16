# FOCUS

> **F**acial **O**bservation & **C**oncentration **U**nderstanding **S**ystem

[한국어](#한국어) | [English](#english)

---

## 한국어

### FOCUS란?

FOCUS는 웹캠을 통해 사용자의 얼굴을 실시간으로 분석하여 학습 집중도를 측정하는 웹 애플리케이션입니다. Google MediaPipe의 Face Landmarker를 활용하여 시선, 표정, 머리 방향 등을 분석하고, 집중도가 저하될 경우 다양한 방식으로 사용자에게 피드백을 제공합니다.

### 주요 기능

- **실시간 집중도 측정**: 얼굴 인식을 통한 집중도 점수 산출
- **3가지 학습 모드**:
  - **일반 모드**: 집중도 측정만 진행
  - **비간섭 모드**: 집중도 저하 시 부드러운 팝업으로 알림 (사용자가 선택적으로 일시정지)
  - **간섭 모드**: 집중도 저하 시 경고음과 함께 자동 일시정지, 집중도 회복 시 자동 재생
- **퀴즈 시스템**: 영상 시청 후 이해도 측정을 위한 퀴즈
- **설문조사**: UX Engagement 및 인지 부하(Cognitive Load) 측정
- **결과 리포트**: 학습 결과를 이메일로 전송

### 집중도 측정 시스템

FOCUS는 다양한 지표를 실시간으로 분석하여 집중도를 측정합니다:

#### 1. 캘리브레이션 (Calibration)
영상 시청 전 3초간 정면을 응시하여 사용자의 기준 상태를 측정합니다:
- 기준 머리 방향 (Yaw, Pitch, Roll)
- 기준 시선 위치
- 기준 AU(Action Unit) 값

#### 2. 집중 저하 감지 항목

| 감지 항목 | 설명 | 감점 |
|-----------|------|------|
| **눈 감음** | 1초 이상 눈을 감은 경우 | -40점 |
| **머리 이탈** | 머리가 좌우 25° 또는 상하 20° 이상 벗어난 경우 | -30점 |
| **시선 이탈** | 머리 회전을 보정한 시선이 화면에서 벗어난 경우 | -25점 |
| **하품** | 입을 크게 벌린 경우 (jawOpen > 0.4) | -20점 |
| **과도한 움직임** | 얼굴이 1초간 과하게 움직인 경우 | -15점 |
| **AU 기반 감지** | 눈썹 찌푸림, 부적절한 미소 등 | -5~10점 |

#### 3. 시선 추적 (Gaze Tracking)

MediaPipe의 홍채 랜드마크를 활용하여 시선 방향을 추적합니다:
- 눈 영역 내 홍채의 상대적 위치 계산
- **머리 회전 보정**: 머리가 돌아가도 눈이 화면을 보고 있으면 정상으로 판단
  - 예: 머리를 오른쪽으로 20° 돌렸을 때, 눈동자가 왼쪽으로 향하면 화면을 보는 것으로 인식

#### 4. AU (Action Unit) 분석

Facial Action Coding System 기반의 표정 분석:
- **AU1**: 눈썹 안쪽 올림 (걱정/혼란)
- **AU4**: 눈썹 찌푸림 (피로/스트레스)
- **AU5**: 눈 넓게 뜸 (놀람/산만)
- **AU12**: 부적절한 미소 (딴 생각)
- **AU15**: 입꼬리 내림 (불만/지루함)
- **AU18**: 입 오므림
- **AU22**: 입 동그랗게
- **AU24**: 입술 누름 (긴장)

### 기술 스택

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Face Detection**: MediaPipe Face Landmarker
- **Build Tool**: Vite
- **Email**: EmailJS

### 시작하기

```bash
# 저장소 클론
git clone https://github.com/your-repo/2025_COMP0738_Team6.git

# 디렉토리 이동
cd 2025_COMP0738_Team6/focus-web

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버는 `https://localhost:3000`에서 실행됩니다.
(카메라 접근을 위해 HTTPS가 필요합니다)

### 프로젝트 구조

```
focus-web/
├── index.html          # 메인 HTML
├── src/
│   ├── main.js         # 애플리케이션 로직
│   ├── styles.css      # 스타일시트
│   └── i18n.js         # 다국어 지원 (한국어/영어)
├── public/
│   ├── videos/         # 학습 영상
│   ├── subtitles/      # 자막 파일 (VTT)
│   ├── quizzes/        # 퀴즈 데이터 (JSON)
│   └── surveys.json    # 설문 데이터
└── package.json
```

---

## English

### What is FOCUS?

FOCUS is a web application that measures learning concentration by analyzing the user's face in real-time through a webcam. It uses Google MediaPipe's Face Landmarker to analyze gaze, facial expressions, and head orientation, providing various types of feedback when concentration decreases.

### Key Features

- **Real-time Concentration Measurement**: Calculate concentration scores through facial recognition
- **3 Learning Modes**:
  - **Normal Mode**: Only measures concentration
  - **Non-Intrusive Mode**: Gentle popup notification when concentration drops (user chooses to pause)
  - **Intrusive Mode**: Warning sound and automatic pause when concentration drops, auto-resume when recovered
- **Quiz System**: Quizzes to measure comprehension after watching videos
- **Survey**: Measures UX Engagement and Cognitive Load
- **Result Report**: Send learning results via email

### Concentration Measurement System

FOCUS analyzes various indicators in real-time to measure concentration:

#### 1. Calibration
Before watching the video, users look straight ahead for 3 seconds to establish baseline measurements:
- Baseline head orientation (Yaw, Pitch, Roll)
- Baseline gaze position
- Baseline AU (Action Unit) values

#### 2. Distraction Detection Items

| Detection Item | Description | Score Penalty |
|----------------|-------------|---------------|
| **Eyes Closed** | Eyes closed for more than 1 second | -40 points |
| **Head Away** | Head turned more than 25° horizontally or 20° vertically | -30 points |
| **Gaze Away** | Gaze leaves the screen (with head rotation compensation) | -25 points |
| **Yawning** | Mouth opened wide (jawOpen > 0.4) | -20 points |
| **Restless Movement** | Excessive face movement over 1 second | -15 points |
| **AU-based Detection** | Frowning, inappropriate smiling, etc. | -5~10 points |

#### 3. Gaze Tracking

Uses MediaPipe iris landmarks to track gaze direction:
- Calculates relative position of iris within eye region
- **Head Rotation Compensation**: Recognizes looking at screen even when head is turned
  - Example: If head turns 20° right but eyes look left, system recognizes user is still looking at screen

#### 4. AU (Action Unit) Analysis

Facial expression analysis based on Facial Action Coding System:
- **AU1**: Inner brow raise (worry/confusion)
- **AU4**: Brow lowerer (fatigue/stress)
- **AU5**: Upper lid raise (surprise/distraction)
- **AU12**: Inappropriate smile (mind wandering)
- **AU15**: Lip corner depressor (dissatisfaction/boredom)
- **AU18**: Lip pucker
- **AU22**: Lip funneler
- **AU24**: Lip pressor (tension)

### Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Face Detection**: MediaPipe Face Landmarker
- **Build Tool**: Vite
- **Email**: EmailJS

### Getting Started

```bash
# Clone repository
git clone https://github.com/your-repo/2025_COMP0738_Team6.git

# Navigate to directory
cd 2025_COMP0738_Team6/focus-web

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server runs at `https://localhost:3000` by default.
(HTTPS is required for camera access)

### Project Structure

```
focus-web/
├── index.html          # Main HTML
├── src/
│   ├── main.js         # Application logic
│   ├── styles.css      # Stylesheet
│   └── i18n.js         # Internationalization (Korean/English)
├── public/
│   ├── videos/         # Learning videos
│   ├── subtitles/      # Subtitle files (VTT)
│   ├── quizzes/        # Quiz data (JSON)
│   └── surveys.json    # Survey data
└── package.json
```

---

## License

This project was developed as part of COMP0738 coursework.
