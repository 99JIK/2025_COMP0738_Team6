import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { i18n } from './i18n.js';

const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

class FocusApp {
  constructor() {
    this.faceLandmarker = null;
    this.cameraElement = document.getElementById('camera-preview');
    this.canvasElement = document.getElementById('landmark-canvas');
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.drawingUtils = null;

    this.learningVideo = document.getElementById('learning-video');
    this.videoPlaceholder = document.getElementById('video-placeholder');
    this.unfocusOverlay = document.getElementById('unfocus-overlay');
    this.cameraContainer = document.getElementById('camera-preview-container');

    this.listPage = document.getElementById('list-page');
    this.watchPage = document.getElementById('watch-page');
    this.quizPage = document.getElementById('quiz-page');
    this.videoList = document.getElementById('video-list');
    this.backBtn = document.getElementById('back-btn');
    this.langToggle = document.getElementById('lang-toggle');
    this.langIcon = document.getElementById('lang-icon');
    this.debugToggle = document.getElementById('debug-toggle');

    // Subtitle elements
    this.subtitleToggle = document.getElementById('subtitle-toggle');
    this.subtitleMenu = document.getElementById('subtitle-menu');
    this.customSubtitle = document.getElementById('custom-subtitle');
    this.subtitleText = this.customSubtitle.querySelector('.subtitle-text');
    this.mobileSubtitleArea = document.getElementById('mobile-subtitle-area');
    this.mobileSubtitleText = this.mobileSubtitleArea.querySelector('.subtitle-text');
    this.subtitleCues = [];
    this.subtitleEnabled = false;
    this.currentSubtitleLang = 'off';

    this.videos = [];
    this.currentVideoName = null;
    this.quizData = null;
    this.currentQuizIndex = 0;
    this.quizScore = 0;
    this.shuffledProblems = [];

    this.isRunning = false;
    this.debugMode = false;
    this.lastVideoTime = -1;
    this.isVideoPlaying = false;
    this.faceDetected = false;

    this.currentMode = 'normal';
    this.pendingVideoIndex = null;
    this.modeModal = document.getElementById('mode-modal');
    this.baseVolume = 1.0;
    this.volumeBoosted = false;
    this.intrusivePaused = false;
    this.focusRecoveryStart = null;
    this.lastIntrusivePauseTime = 0; // 간섭 모드 쿨타임용
    this.warningSound = this.createWarningSound();

    this.isCalibrated = false;
    this.calibrationData = null;
    this.calibrationFrames = [];
    this.CALIBRATION_FRAME_COUNT = 30;

    this.GAZE_AWAY_THRESHOLD = 0.05; // 시선 이탈 임계값 (높을수록 덜 예민)
    this.UNFOCUS_THRESHOLD = 75;

    this.scoreElement = document.getElementById('score-value');
    this.statusElement = document.getElementById('status-text');
    this.debugScore = document.querySelector('#debug-overlay .debug-score');
    this.playVideoBtn = document.getElementById('play-video-btn');

    // Survey elements
    this.surveyPage = document.getElementById('survey-page');
    this.surveyData = null;
    this.currentSurveySection = 0;
    this.surveyResponses = {};
    this.surveySections = [];
    this.tempSurveyResponses = {};

    // Result page elements
    this.resultPage = document.getElementById('result-page');

    // Focus score tracking
    this.focusScoreHistory = [];
    this.averageFocusScore = 0;

    // AU-based focus detection
    this.lastScoreTime = 0;
    this.SCORE_INTERVAL = 1000; // 1초 간격으로 점수 기록
    this.auHistory = []; // AU 데이터 히스토리

    // 눈 감음 지속 시간 추적 (1초 이상 감았을 때만 감점)
    this.eyesClosedStartTime = null;
    this.EYES_CLOSED_THRESHOLD_MS = 1000; // 1초

    // 얼굴 움직임(산만함) 감지
    this.facePositionHistory = []; // 최근 얼굴 위치 기록
    this.FACE_HISTORY_SIZE = 30; // 약 1초간의 프레임 (30fps 기준)
    this.FACE_MOVEMENT_THRESHOLD = 0.07; // 움직임 임계값 - 과도한 움직임만 감지

    // 집중력 저하 관련 AU 임계값
    this.AU_THRESHOLDS = {
      browDownLeft: 0.3,      // AU4 - 눈썹 찌푸림
      browDownRight: 0.3,
      eyeSquintLeft: 0.4,     // AU6/AU7 - 눈 찡그림
      eyeSquintRight: 0.4,
      mouthSmileLeft: 0.4,    // AU12 - 부적절한 미소
      mouthSmileRight: 0.4,
      jawOpen: 0.4,           // AU26/AU27 - 하품/입 벌림
      eyeBlinkLeft: 0.5,      // AU45 - 눈 깜빡임
      eyeBlinkRight: 0.5,
      mouthPucker: 0.4,       // AU18 - 입 오므림(딴 생각)
    };

    // 비간섭 모드 관련 변수
    this.UNFOCUS_DURATION_THRESHOLD = 5000; // 5초 지속 집중 저하 시 팝업
    this.popupCooldown = 30000; // 기본 30초 쿨타임
    this.unfocusStartTime = null; // 집중 저하 시작 시간
    this.lastPopupTime = 0; // 마지막 팝업 시간
    this.isPopupShowing = false; // 팝업 표시 중 여부
    this.focusPopup = null; // 팝업 엘리먼트

    // 슬라이딩 윈도우 평균 점수 (최근 5초)
    this.recentScores = []; // {timestamp, score} 배열
    this.SLIDING_WINDOW_MS = 5000; // 5초 윈도우

    this.init();
  }

  async init() {
    try {
      this.debugToggle.addEventListener('click', () => this.toggleDebug());
      this.backBtn.addEventListener('click', () => this.handleBack());
      this.langToggle.addEventListener('click', () => this.toggleLanguage());
      this.playVideoBtn.addEventListener('click', () => this.startVideoPlayback());

      // Survey event listeners
      document.getElementById('survey-prev-btn').addEventListener('click', () => this.navigateSurvey(-1));
      document.getElementById('survey-next-btn').addEventListener('click', () => this.navigateSurvey(1));
      document.getElementById('survey-finish-btn').addEventListener('click', () => this.showListPage());

      // Result page event listeners
      document.getElementById('submit-results-btn').addEventListener('click', () => this.showResultPage());
      document.getElementById('back-to-list-btn').addEventListener('click', () => this.showListPage());

      // Initialize EmailJS
      if (typeof emailjs !== 'undefined') {
        emailjs.init('KSOqzDfw8a69o-Cq-');
      }

      this.learningVideo.addEventListener('ended', () => this.onVideoEnded());
      this.learningVideo.addEventListener('timeupdate', () => this.updateSubtitle());

      // Subtitle controls (desktop)
      this.subtitleToggle.addEventListener('click', () => this.toggleSubtitleMenu());
      this.subtitleMenu.querySelectorAll('.subtitle-option').forEach(btn => {
        btn.addEventListener('click', () => this.selectSubtitleLang(btn.dataset.lang));
      });

      // Subtitle controls (mobile portrait)
      this.mobileSubtitleToggle = document.getElementById('mobile-subtitle-toggle');
      this.mobileSubtitleMenu = document.getElementById('mobile-subtitle-menu');
      this.mobileSubtitleToggle.addEventListener('click', () => this.toggleMobileSubtitleMenu());
      this.mobileSubtitleMenu.querySelectorAll('.subtitle-option').forEach(btn => {
        btn.addEventListener('click', () => this.selectSubtitleLang(btn.dataset.lang));
      });

      document.addEventListener('click', (e) => {
        // Close desktop menu
        if (!this.subtitleToggle.contains(e.target) && !this.subtitleMenu.contains(e.target)) {
          this.subtitleMenu.classList.add('hidden');
        }
        // Close mobile menu
        if (!this.mobileSubtitleToggle.contains(e.target) && !this.mobileSubtitleMenu.contains(e.target)) {
          this.mobileSubtitleMenu.classList.add('hidden');
        }
      });

      this.modeModal.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
      });

      // 모달 밖 클릭 시 닫기
      this.modeModal.addEventListener('click', (e) => {
        if (e.target === this.modeModal) {
          this.hideModeModal();
        }
      });

      // Cooldown setting (초 단위 입력)
      const cooldownInput = document.getElementById('cooldown-input');
      cooldownInput.addEventListener('change', (e) => {
        const seconds = parseInt(e.target.value) || 30;
        this.popupCooldown = seconds * 1000;
        e.target.value = seconds; // 유효한 값으로 업데이트
      });

      // Non-intrusive popup event listeners
      this.focusPopup = document.getElementById('focus-popup');
      document.getElementById('popup-pause-btn').addEventListener('click', () => this.handlePopupPause());
      document.getElementById('popup-continue-btn').addEventListener('click', () => this.handlePopupContinue());
      document.getElementById('resume-btn').addEventListener('click', () => this.handleResume());

      await this.loadVideoList();
      this.updateLanguageUI();
      this.renderVideoList();

      await this.loadMediaPipe();
    } catch (error) {
      console.error('Init error:', error);
      this.statusElement.textContent = `Error: ${error.message}`;
    }
  }

  showModeModal(videoIndex) {
    this.pendingVideoIndex = videoIndex;
    this.updateModeModalUI();
    this.modeModal.classList.remove('hidden');
  }

  hideModeModal() {
    this.modeModal.classList.add('hidden');
    this.pendingVideoIndex = null;
  }

  updateModeModalUI() {
    document.getElementById('mode-modal-title').textContent = i18n.t('selectMode');
    document.getElementById('mode-normal-name').textContent = i18n.t('modeNormal');
    document.getElementById('mode-normal-desc').textContent = i18n.t('modeNormalDesc');
    document.getElementById('mode-nonintrusive-name').textContent = i18n.t('modeNonIntrusive');
    document.getElementById('mode-nonintrusive-desc').textContent = i18n.t('modeNonIntrusiveDesc');
    document.getElementById('mode-intrusive-name').textContent = i18n.t('modeIntrusive');
    document.getElementById('mode-intrusive-desc').textContent = i18n.t('modeIntrusiveDesc');
    document.getElementById('cooldown-setting-label').textContent = i18n.t('popupCooldownSetting');

    // Update popup UI
    document.getElementById('focus-popup-title').textContent = i18n.t('popupTitle');
    document.getElementById('popup-pause-btn').textContent = i18n.t('popupPause');
    document.getElementById('popup-continue-btn').textContent = i18n.t('popupContinue');

    // Update cooldown input label
    document.getElementById('cooldown-unit').textContent = i18n.t('popupCooldownSeconds');
  }

  selectMode(mode) {
    this.currentMode = mode;
    const videoIndex = this.pendingVideoIndex;
    this.hideModeModal();

    if (videoIndex !== null) {
      this.startWatchingVideo(videoIndex);
    }
  }


  async loadVideoList() {
    try {
      const response = await fetch('/videos.json');
      const data = await response.json();
      this.videos = data.videos || [];
    } catch (error) {
      console.error('Failed to load video list:', error);
      this.videos = [];
    }
  }

  renderVideoList() {
    if (this.videos.length === 0) {
      this.videoList.innerHTML = `<p class="empty-message">${i18n.t('noVideos')}</p>`;
      return;
    }

    const videoIcons = ['&#120587;', '&#9834;', '&#9651;']; // π, ♪, △

    this.videoList.innerHTML = this.videos.map((videoName, index) => `
      <div class="video-card" data-index="${index}">
        <div class="video-card-thumbnail">
          <span class="video-card-icon">${videoIcons[index % videoIcons.length]}</span>
          <div class="video-card-overlay">
            <button class="watch-btn" data-index="${index}">
              <span class="play-icon">&#9658;</span>
              ${i18n.t('watch')}
            </button>
          </div>
        </div>
        <div class="video-card-content">
          <h3 class="video-card-title">${videoName}</h3>
          <span class="video-card-source">3Blue1Brown</span>
        </div>
      </div>
    `).join('');

    this.videoList.querySelectorAll('.watch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.watchVideo(parseInt(btn.dataset.index));
      });
    });

    this.videoList.querySelectorAll('.video-card').forEach(card => {
      card.addEventListener('click', () => this.watchVideo(parseInt(card.dataset.index)));
    });
  }

  watchVideo(index) {
    const videoName = this.videos[index];
    if (!videoName) return;

    this.showModeModal(index);
  }

  startWatchingVideo(index) {
    const videoName = this.videos[index];
    if (!videoName) return;

    this.currentVideoName = videoName;
    this.learningVideo.src = `/videos/${encodeURIComponent(videoName)}/video.mp4`;
    this.isVideoPlaying = false;
    this.faceDetected = false;
    this.volumeBoosted = false;
    this.intrusivePaused = false;
    this.focusRecoveryStart = null;
    this.baseVolume = 1.0;
    this.learningVideo.volume = this.baseVolume;

    // Load subtitles
    this.loadSubtitles(videoName);

    this.applyModeSettings();
    this.showWatchPage();

    // 모드 관련 변수 초기화
    this.unfocusStartTime = null;
    this.isPopupShowing = false;
    this.recentScores = []; // 슬라이딩 윈도우 초기화
    this.lastPopupTime = 0; // 첫 팝업은 쿨타임 없이 바로 표시
    if (this.focusPopup) {
      this.focusPopup.classList.add('hidden');
    }

    // 모든 모드에서 얼굴 인식 시작 (집중력 점수 측정)
    this.startFaceDetection();
  }

  applyModeSettings() {
    // 모든 모드에서 플레이어 컨트롤 사용 가능
    this.learningVideo.controls = true;
  }

  async startFaceDetection() {
    try {
      // 디버그 모드가 아니면 debug-overlay, side-panel 숨김
      if (!this.debugMode) {
        document.getElementById('debug-overlay').classList.add('hidden');
        document.getElementById('side-panel').classList.add('hidden');
      }

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.cameraElement.srcObject = stream;
      this.cameraElement.setAttribute('playsinline', 'true');
      this.cameraElement.setAttribute('autoplay', 'true');
      await this.cameraElement.play();

      this.canvasElement.width = this.cameraElement.videoWidth;
      this.canvasElement.height = this.cameraElement.videoHeight;

      this.isRunning = true;
      this.statusElement.textContent = i18n.t('detectingFace');
      this.playVideoBtn.classList.add('hidden');

      this.detectFaceLoop();
    } catch (error) {
      console.error('Camera error:', error.name, error.message);
      let errorMsg = i18n.t('cameraAccessFailed');
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg += ': ' + (i18n.getLang() === 'ko' ? '권한 거부됨' : 'Permission denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg += ': ' + (i18n.getLang() === 'ko' ? '카메라 없음' : 'No camera');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMsg += ': ' + (i18n.getLang() === 'ko' ? '카메라 사용 중' : 'Camera in use');
      } else if (error.name === 'OverconstrainedError') {
        errorMsg += ': ' + (i18n.getLang() === 'ko' ? '카메라 설정 오류' : 'Camera constraints error');
      } else if (error.name === 'TypeError') {
        errorMsg += ': ' + (i18n.getLang() === 'ko' ? '보안 오류' : 'Security error');
      } else {
        errorMsg += `: ${error.name || error.message}`;
      }
      this.statusElement.textContent = errorMsg;
    }
  }

  detectFaceLoop() {
    if (!this.isRunning || this.isVideoPlaying) return;

    if (this.cameraElement.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.cameraElement.currentTime;

      const results = this.faceLandmarker.detectForVideo(
        this.cameraElement,
        performance.now()
      );

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        if (!this.faceDetected) {
          this.faceDetected = true;
          this.statusElement.textContent = i18n.t('faceDetected');

          // 일반/간섭 모드는 얼굴 인식 즉시 시작, 비간섭은 버튼 클릭으로 시작
          if (this.currentMode === 'normal' || this.currentMode === 'intrusive') {
            this.startVideoPlayback();
            return;
          }

          // 비간섭 모드만 버튼 표시
          this.playVideoBtn.classList.remove('hidden');
          this.playVideoBtn.textContent = i18n.t('playVideo');
        }
      } else {
        if (this.faceDetected) {
          this.faceDetected = false;
          this.statusElement.textContent = i18n.t('detectingFace');
          this.playVideoBtn.classList.add('hidden');
        }
      }
    }

    requestAnimationFrame(() => this.detectFaceLoop());
  }

  startVideoPlayback() {
    if (!this.faceDetected) return;

    this.isVideoPlaying = true;
    this.isCalibrated = false;
    this.calibrationFrames = [];
    this.focusScoreHistory = [];  // Reset focus score history
    this.auHistory = [];          // Reset AU history
    this.lastScoreTime = 0;       // Reset score timer

    // 디버그 모드가 아니면 debug-overlay, side-panel 숨김
    if (!this.debugMode) {
      document.getElementById('debug-overlay').classList.add('hidden');
      document.getElementById('side-panel').classList.add('hidden');
    }

    this.learningVideo.classList.add('active');
    this.videoPlaceholder.classList.add('hidden');
    this.learningVideo.play();

    this.statusElement.textContent = i18n.t('lookAtCamera');
    this.processFrame();
  }

  async onVideoEnded() {
    this.stopAnalysis();

    // Calculate average focus score
    this.calculateAverageFocusScore();

    // 영상 종료 후 설문 먼저 진행 (퀴즈 결과가 설문에 영향 주지 않도록)
    await this.loadQuiz(); // 미리 로드
    this.showSurveyPage();
  }

  calculateAverageFocusScore() {
    if (this.focusScoreHistory.length === 0) {
      this.averageFocusScore = 0;
      return;
    }

    const sum = this.focusScoreHistory.reduce((acc, item) => acc + item.score, 0);
    this.averageFocusScore = Math.round(sum / this.focusScoreHistory.length);
  }

  // AU 통계 계산
  calculateAUStats() {
    if (this.auHistory.length === 0) {
      return null;
    }

    const auKeys = ['browDown', 'eyeSquint', 'smile', 'jawOpen',
                    'eyeBlink', 'mouthPucker', 'mouthPress', 'eyeWide',
                    'mouthFrown', 'browInnerUp', 'mouthFunnel'];

    const stats = {};

    auKeys.forEach(key => {
      const values = this.auHistory.map(entry => entry[key] || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);

      // 임계값 초과 횟수 계산
      const threshold = this.AU_THRESHOLDS[key + 'Left'] || this.AU_THRESHOLDS[key] || 0.3;
      const exceedCount = values.filter(v => v > threshold).length;

      stats[key] = {
        average: Math.round(avg * 1000) / 1000,
        max: Math.round(max * 1000) / 1000,
        exceedCount: exceedCount,
        exceedRate: Math.round((exceedCount / values.length) * 100)
      };
    });

    return {
      totalSamples: this.auHistory.length,
      durationSeconds: this.auHistory.length, // 1초 간격이므로
      auMetrics: stats
    };
  }

  async loadQuiz() {
    try {
      const response = await fetch(`/videos/${encodeURIComponent(this.currentVideoName)}/quiz.json`);
      this.quizData = await response.json();
      this.shuffledProblems = this.shuffleArray([...this.quizData.problems]);
      this.currentQuizIndex = 0;
      this.quizScore = 0;
    } catch (error) {
      console.error('Failed to load quiz:', error);
      this.quizData = null;
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  showQuizPage() {
    if (!this.quizData || this.shuffledProblems.length === 0) {
      this.showListPage();
      return;
    }

    this.listPage.classList.add('hidden');
    this.watchPage.classList.add('hidden');
    this.surveyPage.classList.add('hidden');
    this.quizPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');
    this.debugToggle.classList.add('hidden');

    document.getElementById('quiz-title').textContent = i18n.t('quiz');
    document.getElementById('quiz-total').textContent = '10';
    document.getElementById('submit-results-btn').textContent = i18n.getLang() === 'ko' ? '결과 제출' : 'Submit Results';
    document.getElementById('participant-label').textContent = i18n.getLang() === 'ko' ? '참가자 이름' : 'Participant Name';
    document.getElementById('participant-name').placeholder = i18n.getLang() === 'ko' ? '이름을 입력하세요' : 'Enter your name';
    document.getElementById('participant-name').value = ''; // Reset
    document.getElementById('quiz-result').classList.add('hidden');
    document.querySelector('.quiz-content').classList.remove('hidden');

    this.renderQuizQuestion();
  }

  getLocalizedText(obj) {
    const lang = i18n.getLang();
    return obj[lang] || obj.en || obj;
  }

  renderQuizQuestion() {
    const problem = this.shuffledProblems[this.currentQuizIndex];
    const lang = i18n.getLang();

    document.getElementById('quiz-current').textContent = this.currentQuizIndex + 1;
    document.getElementById('quiz-question').textContent = this.getLocalizedText(problem.problem);

    const rightAnswer = this.getLocalizedText(problem.right);
    const wrongAnswers = problem.wrong.slice(0, 4).map(w => this.getLocalizedText(w));
    const answers = this.shuffleArray([rightAnswer, ...wrongAnswers]);

    const answersContainer = document.getElementById('quiz-answers');

    answersContainer.innerHTML = answers.map(answer => `
      <button class="quiz-answer-btn" data-answer="${answer}">${answer}</button>
    `).join('');

    answersContainer.querySelectorAll('.quiz-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectAnswer(btn.dataset.answer, rightAnswer));
    });
  }

  selectAnswer(selected, correct) {
    const buttons = document.querySelectorAll('.quiz-answer-btn');
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer === correct) {
        btn.classList.add('correct');
      } else if (btn.dataset.answer === selected && selected !== correct) {
        btn.classList.add('wrong');
      }
    });

    if (selected === correct) {
      this.quizScore += 10;
    }

    setTimeout(() => {
      this.currentQuizIndex++;
      if (this.currentQuizIndex < 10 && this.currentQuizIndex < this.shuffledProblems.length) {
        this.renderQuizQuestion();
      } else {
        this.showQuizResult();
      }
    }, 1000);
  }

  showQuizResult() {
    document.querySelector('.quiz-content').classList.add('hidden');
    const resultDiv = document.getElementById('quiz-result');
    resultDiv.classList.remove('hidden');

    // 퀴즈 완료 메시지 다국어 지원
    document.getElementById('quiz-complete-title').textContent =
      i18n.getLang() === 'ko' ? '퀴즈 완료!' : 'Quiz Complete!';
  }

  showWatchPage() {
    this.listPage.classList.add('hidden');
    this.watchPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');
    this.debugToggle.classList.remove('hidden');
    this.videoPlaceholder.classList.remove('hidden');
    this.learningVideo.classList.remove('active');
    this.statusElement.textContent = i18n.t('detectingFace');

    // 디버그 모드가 아니면 debug-overlay, side-panel 숨김
    const debugOverlay = document.getElementById('debug-overlay');
    const sidePanel = document.getElementById('side-panel');
    if (!this.debugMode) {
      debugOverlay.classList.add('hidden');
      sidePanel.classList.add('hidden');
    } else {
      debugOverlay.classList.remove('hidden');
      sidePanel.classList.remove('hidden');
    }
  }

  toggleLanguage() {
    i18n.toggleLang();
    this.updateLanguageUI();
    this.renderVideoList();
  }

  updateLanguageUI() {
    this.langIcon.textContent = i18n.getLang() === 'ko' ? 'EN' : 'KO';

    document.getElementById('list-title').innerHTML = i18n.t('focusAcronym');
    document.getElementById('hero-description').textContent = i18n.t('heroDescription');
    document.getElementById('unfocus-message').textContent = i18n.t('focusPlease');
    this.playVideoBtn.textContent = i18n.t('playVideo');

    // Update attribution text
    const attributionEl = document.getElementById('attribution-text');
    if (attributionEl) {
      attributionEl.innerHTML = `<span class="attribution-icon">&#127909;</span> ${i18n.t('attribution')} <a href="https://www.youtube.com/@3blue1brown" target="_blank" rel="noopener">3Blue1Brown</a>`;
    }

    if (!this.isRunning) {
      this.statusElement.textContent = i18n.t('ready');
    }
  }

  async loadMediaPipe() {
    try {
      this.statusElement.textContent = 'Loading MediaPipe...';

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.statusElement.textContent = 'Loading Face Model...';

      const createOptions = {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      };

      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, createOptions);
      } catch (gpuError) {
        console.warn('GPU failed, trying CPU:', gpuError);
        this.statusElement.textContent = 'Loading (CPU mode)...';
        createOptions.baseOptions.delegate = 'CPU';
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, createOptions);
      }

      this.drawingUtils = new DrawingUtils(this.canvasCtx);
      this.statusElement.textContent = i18n.t('ready');
    } catch (error) {
      console.error('MediaPipe error:', error);
      this.statusElement.textContent = `MediaPipe Error: ${error.message}`;
    }
  }

  stopAnalysis() {
    this.isRunning = false;
    this.isCalibrated = false;
    this.calibrationData = null;
    this.isVideoPlaying = false;
    this.statusElement.textContent = i18n.t('stopped');

    const stream = this.cameraElement.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    this.cameraElement.srcObject = null;

    this.learningVideo.pause();
    this.unfocusOverlay.classList.add('hidden');
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  processFrame() {
    if (!this.isRunning) return;

    if (this.cameraElement.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.cameraElement.currentTime;

      if (this.debugMode) {
        const containerWidth = this.cameraContainer.clientWidth;
        const containerHeight = this.cameraContainer.clientHeight;
        if (this.canvasElement.width !== containerWidth || this.canvasElement.height !== containerHeight) {
          this.canvasElement.width = containerWidth;
          this.canvasElement.height = containerHeight;
        }
      }

      const results = this.faceLandmarker.detectForVideo(
        this.cameraElement,
        performance.now()
      );

      // 디버그 모드에서는 캘리브레이션 중에도 랜드마크 표시
      if (this.debugMode) {
        this.drawLandmarks(results);
      }

      // 영상이 일시정지 상태면 집중도 분석 스킵
      // 단, 팝업이 열려있거나 간섭 모드에서 일시정지된 경우는 계속 체크
      const isVideoPaused = this.learningVideo && this.learningVideo.paused;
      const isPopupVisible = this.focusPopup && !this.focusPopup.classList.contains('hidden');
      const isIntrusiveModePaused = this.currentMode === 'intrusive' && this.intrusivePaused;

      if (!this.isCalibrated) {
        this.calibrate(results);
        // 캘리브레이션 중에도 디버그 UI 업데이트
        if (this.debugMode && results.faceLandmarks && results.faceLandmarks.length > 0) {
          this.scoreElement.textContent = '--';
          if (this.debugScore) this.debugScore.classList.remove('high', 'medium', 'low');
        }
      } else if (!isVideoPaused || isPopupVisible || isIntrusiveModePaused) {
        // 영상이 재생 중이거나, 팝업이 열려있거나, 간섭 모드에서 일시정지된 경우 집중도 분석
        this.analyzeResults(results);
      }
    }

    requestAnimationFrame(() => this.processFrame());
  }

  getIrisCenter(landmarks, irisIndices) {
    let x = 0, y = 0;
    for (const idx of irisIndices) {
      x += landmarks[idx].x;
      y += landmarks[idx].y;
    }
    return { x: x / irisIndices.length, y: y / irisIndices.length };
  }

  checkGazeAway(gazeRatio, headYaw = 0) {
    // X축만 사용 (Y축은 너무 민감해서 제거)
    const thresholdX = Math.max(this.GAZE_AWAY_THRESHOLD, this.calibrationData.stdGazeX * 3);

    // 머리 회전에 따른 시선 보정
    // 머리가 오른쪽으로 돌아가면 (yaw > 0), 화면을 보려면 눈동자가 왼쪽으로 이동
    // gazeRatio.avgX: 작을수록 왼쪽, 클수록 오른쪽
    // 따라서 yaw가 양수일 때 예상 시선은 감소 (왼쪽으로)
    const yawFromBase = headYaw - (this.calibrationData.baseYaw || 0);
    // yaw 1도당 약 0.004의 시선 비율 변화 (실험값 기반)
    // yaw +22° 일 때: baseGazeX ≈ 0.48, 실제 gaze = 0.415
    // 필요한 shift: 0.48 - 0.415 = 0.065, 0.065/22 ≈ 0.003
    // 여유를 두고 0.004로 설정
    const expectedGazeShift = -yawFromBase * 0.004;
    const expectedGazeX = this.calibrationData.baseGazeX + expectedGazeShift;

    const gazeDiffX = Math.abs(gazeRatio.avgX - expectedGazeX);

    return gazeDiffX > thresholdX;
  }

  // 얼굴 중심 좌표 계산 (코 끝 기준)
  getFaceCenter(landmarks) {
    // 코 끝 (landmark 1)을 얼굴 중심으로 사용
    const noseTip = landmarks[1];
    return { x: noseTip.x, y: noseTip.y };
  }

  // 얼굴 움직임(산만함) 감지
  checkFaceMovement(landmarks) {
    const faceCenter = this.getFaceCenter(landmarks);

    // 위치 기록 추가
    this.facePositionHistory.push(faceCenter);

    // 최근 N개 프레임만 유지
    if (this.facePositionHistory.length > this.FACE_HISTORY_SIZE) {
      this.facePositionHistory.shift();
    }

    // 충분한 데이터가 없으면 false 반환
    if (this.facePositionHistory.length < this.FACE_HISTORY_SIZE / 2) {
      return false;
    }

    // X, Y 좌표 배열 추출
    const xPositions = this.facePositionHistory.map(p => p.x);
    const yPositions = this.facePositionHistory.map(p => p.y);

    // 표준편차 계산
    const stdX = this.calculateStd(xPositions);
    const stdY = this.calculateStd(yPositions);

    // X 또는 Y 방향으로 과도한 움직임이 있으면 산만함으로 판단
    return stdX > this.FACE_MOVEMENT_THRESHOLD || stdY > this.FACE_MOVEMENT_THRESHOLD;
  }

  // 표준편차 계산 헬퍼 함수
  calculateStd(values) {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);
  }

  getGazeRatio(landmarks) {
    const leftIris = this.getIrisCenter(landmarks, LEFT_IRIS_INDICES);
    const rightIris = this.getIrisCenter(landmarks, RIGHT_IRIS_INDICES);

    const leftEyeWidth = Math.abs(landmarks[LEFT_EYE_OUTER].x - landmarks[LEFT_EYE_INNER].x);
    const rightEyeWidth = Math.abs(landmarks[RIGHT_EYE_OUTER].x - landmarks[RIGHT_EYE_INNER].x);
    const leftEyeHeight = Math.abs(landmarks[LEFT_EYE_TOP].y - landmarks[LEFT_EYE_BOTTOM].y);
    const rightEyeHeight = Math.abs(landmarks[RIGHT_EYE_TOP].y - landmarks[RIGHT_EYE_BOTTOM].y);
    const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

    const leftRatioX = (leftIris.x - landmarks[LEFT_EYE_OUTER].x) / leftEyeWidth;
    const rightRatioX = (rightIris.x - landmarks[RIGHT_EYE_INNER].x) / rightEyeWidth;

    const leftEyeCenterY = (landmarks[LEFT_EYE_TOP].y + landmarks[LEFT_EYE_BOTTOM].y) / 2;
    const rightEyeCenterY = (landmarks[RIGHT_EYE_TOP].y + landmarks[RIGHT_EYE_BOTTOM].y) / 2;
    const leftRatioY = (leftIris.y - leftEyeCenterY) / (leftEyeHeight || 0.01);
    const rightRatioY = (rightIris.y - rightEyeCenterY) / (rightEyeHeight || 0.01);

    return {
      leftX: leftRatioX,
      rightX: rightRatioX,
      avgX: (leftRatioX + rightRatioX) / 2,
      leftY: leftRatioY,
      rightY: rightRatioY,
      avgY: (leftRatioY + rightRatioY) / 2,
      avgEyeHeight: avgEyeHeight // 눈 높이 캘리브레이션용
    };
  }

  calibrate(results) {
    if (!results.facialTransformationMatrixes || results.facialTransformationMatrixes.length === 0 ||
        !results.faceLandmarks || results.faceLandmarks.length === 0 ||
        !results.faceBlendshapes || results.faceBlendshapes.length === 0) {
      this.statusElement.textContent = i18n.t('showFaceToCamera');
      return;
    }

    const matrix = results.facialTransformationMatrixes[0].data;
    const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
    const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8] * matrix[8] + matrix[10] * matrix[10])) * (180 / Math.PI);
    const roll = Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI);

    const landmarks = results.faceLandmarks[0];
    const gazeRatio = this.getGazeRatio(landmarks);

    // AU 데이터 추출 (캘리브레이션용)
    const blendshapes = results.faceBlendshapes[0].categories;
    const getBlendshape = (name) => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? shape.score : 0;
    };
    const auData = this.extractAUData(getBlendshape);

    this.calibrationFrames.push({
      yaw, pitch, roll,
      gazeX: gazeRatio.avgX,
      gazeY: gazeRatio.avgY,
      eyeHeight: gazeRatio.avgEyeHeight,
      au: auData
    });

    const progress = Math.round((this.calibrationFrames.length / this.CALIBRATION_FRAME_COUNT) * 100);
    this.statusElement.textContent = `${i18n.t('calibrating')} ${progress}%`;

    if (this.calibrationFrames.length >= this.CALIBRATION_FRAME_COUNT) {
      const avgYaw = this.calibrationFrames.reduce((sum, f) => sum + f.yaw, 0) / this.calibrationFrames.length;
      const avgPitch = this.calibrationFrames.reduce((sum, f) => sum + f.pitch, 0) / this.calibrationFrames.length;
      const avgRoll = this.calibrationFrames.reduce((sum, f) => sum + f.roll, 0) / this.calibrationFrames.length;
      const avgGazeX = this.calibrationFrames.reduce((sum, f) => sum + f.gazeX, 0) / this.calibrationFrames.length;
      const avgGazeY = this.calibrationFrames.reduce((sum, f) => sum + f.gazeY, 0) / this.calibrationFrames.length;
      const avgEyeHeight = this.calibrationFrames.reduce((sum, f) => sum + f.eyeHeight, 0) / this.calibrationFrames.length;

      const stdGazeX = Math.sqrt(
        this.calibrationFrames.reduce((sum, f) => sum + Math.pow(f.gazeX - avgGazeX, 2), 0) / this.calibrationFrames.length
      );
      const stdGazeY = Math.sqrt(
        this.calibrationFrames.reduce((sum, f) => sum + Math.pow(f.gazeY - avgGazeY, 2), 0) / this.calibrationFrames.length
      );

      // 눈 높이가 작은 사람을 위한 Y축 감지 가중치 계산
      // 기준 눈 높이(0.03)보다 작으면 Y축 임계값을 완화
      const baseEyeHeight = 0.03;
      const eyeHeightRatio = Math.min(avgEyeHeight / baseEyeHeight, 1.0);
      const gazeYWeightFactor = 0.5 + (eyeHeightRatio * 0.5); // 0.5 ~ 1.0 사이

      // AU 기준값 계산 (사용자의 평소 표정)
      const auKeys = ['browDown', 'eyeSquint', 'smile', 'jawOpen',
                      'eyeBlink', 'mouthPucker', 'mouthPress', 'eyeWide',
                      'mouthFrown', 'browInnerUp', 'mouthFunnel'];
      const baseAU = {};
      for (const key of auKeys) {
        baseAU[key] = this.calibrationFrames.reduce((sum, f) => sum + f.au[key], 0) / this.calibrationFrames.length;
      }

      this.calibrationData = {
        baseYaw: avgYaw,
        basePitch: avgPitch,
        baseRoll: avgRoll,
        baseGazeX: avgGazeX,
        baseGazeY: avgGazeY,
        stdGazeX: stdGazeX,
        stdGazeY: stdGazeY,
        avgEyeHeight: avgEyeHeight,
        gazeYWeightFactor: gazeYWeightFactor,
        baseAU: baseAU
      };

      console.log(`[캘리브레이션] 눈 높이: ${avgEyeHeight.toFixed(4)}, Y축 가중치: ${gazeYWeightFactor.toFixed(2)}`);
      console.log(`[캘리브레이션] AU 기준값:`, baseAU);
      this.isCalibrated = true;
      this.statusElement.textContent = i18n.t('calibrationComplete');
    }
  }

  analyzeResults(results) {
    if (!results.faceBlendshapes || results.faceBlendshapes.length === 0 ||
        !results.faceLandmarks || results.faceLandmarks.length === 0) {
      const warnings = [i18n.t('faceNotDetected')];
      this.updateScore(0, warnings, null);
      this.handleUnfocus(0, warnings);
      return;
    }

    const blendshapes = results.faceBlendshapes[0].categories;
    const getBlendshape = (name) => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? shape.score : 0;
    };

    // 기존 감지 항목
    const eyeBlinkLeft = getBlendshape('eyeBlinkLeft');
    const eyeBlinkRight = getBlendshape('eyeBlinkRight');
    const jawOpen = getBlendshape('jawOpen');

    // AU 추출 (집중력 저하 관련)
    const auData = this.extractAUData(getBlendshape);

    let headTurnAway = false;
    let eyeGazeAway = false;
    let currentYaw = this.calibrationData.baseYaw || 0;

    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      const matrix = results.facialTransformationMatrixes[0].data;
      currentYaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
      const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8] * matrix[8] + matrix[10] * matrix[10])) * (180 / Math.PI);

      const yawDiff = Math.abs(currentYaw - this.calibrationData.baseYaw);
      const pitchDiff = Math.abs(pitch - this.calibrationData.basePitch);

      headTurnAway = yawDiff > 25 || pitchDiff > 20;
    }

    const landmarks = results.faceLandmarks[0];
    const gazeRatio = this.getGazeRatio(landmarks);
    // 머리 회전(yaw)을 고려하여 시선 이탈 체크
    eyeGazeAway = this.checkGazeAway(gazeRatio, currentYaw);

    // 얼굴 움직임(산만함) 감지
    const isFidgeting = this.checkFaceMovement(landmarks);

    // 디버그 모드에서 시선 정보 표시
    if (this.debugMode) {
      this.updateGazeDebug(gazeRatio, eyeGazeAway, currentYaw);
    }

    // 눈 감음 감지: 임계값 0.3으로 낮춤 (0.5는 너무 높음)
    const isEyesClosedNow = eyeBlinkLeft > 0.3 && eyeBlinkRight > 0.3;
    const isYawning = jawOpen > 0.4;

    // 눈 감음 2초 이상 지속 체크
    let isEyesClosedLong = false;
    if (isEyesClosedNow) {
      if (this.eyesClosedStartTime === null) {
        this.eyesClosedStartTime = Date.now();
      } else if (Date.now() - this.eyesClosedStartTime >= this.EYES_CLOSED_THRESHOLD_MS) {
        isEyesClosedLong = true;
      }
    } else {
      this.eyesClosedStartTime = null;
    }

    // 기본 점수 계산
    let score = 100;
    const warnings = [];

    if (isEyesClosedLong) {
      score -= 40;
      warnings.push(i18n.t('eyesClosed'));
    }
    if (headTurnAway) {
      score -= 30;
      warnings.push(i18n.t('headAway'));
    }
    if (eyeGazeAway) {
      score -= 25;
      warnings.push(i18n.t('gazeAway'));
    }
    if (isYawning) {
      score -= 20;
      warnings.push(i18n.t('yawning'));
    }
    if (isFidgeting) {
      score -= 15;
      warnings.push(i18n.t('fidgeting'));
    }

    // AU 기반 추가 감점 및 경고
    const auResult = this.calculateAUPenalty(auData);
    score -= auResult.penalty;
    warnings.push(...auResult.warnings);

    score = Math.max(0, Math.min(100, score));
    this.updateScore(score, warnings, auData);
    this.handleUnfocus(score, warnings);
  }

  // AU 데이터 추출
  extractAUData(getBlendshape) {
    return {
      // AU4 - 눈썹 찌푸림 (피로/스트레스)
      browDown: (getBlendshape('browDownLeft') + getBlendshape('browDownRight')) / 2,
      // AU6/AU7 - 눈 찡그림
      eyeSquint: (getBlendshape('eyeSquintLeft') + getBlendshape('eyeSquintRight')) / 2,
      // AU12 - 부적절한 미소 (딴 생각)
      smile: (getBlendshape('mouthSmileLeft') + getBlendshape('mouthSmileRight')) / 2,
      // AU26/AU27 - 턱 열림 (하품)
      jawOpen: getBlendshape('jawOpen'),
      // AU45 - 눈 깜빡임 (눈 감음)
      eyeBlink: (getBlendshape('eyeBlinkLeft') + getBlendshape('eyeBlinkRight')) / 2,
      // AU18 - 입 오므림 (딴 생각)
      mouthPucker: getBlendshape('mouthPucker'),
      // AU24 - 입술 누름 (긴장/스트레스)
      mouthPress: (getBlendshape('mouthPressLeft') + getBlendshape('mouthPressRight')) / 2,
      // AU5 - 눈 넓게 뜸 (놀람/산만)
      eyeWide: (getBlendshape('eyeWideLeft') + getBlendshape('eyeWideRight')) / 2,
      // AU15 - 입꼬리 내림 (불만/지루함)
      mouthFrown: (getBlendshape('mouthFrownLeft') + getBlendshape('mouthFrownRight')) / 2,
      // AU1 - 눈썹 안쪽 올림 (걱정/혼란)
      browInnerUp: getBlendshape('browInnerUp'),
      // AU22 - 입 동그랗게 (딴 생각/휘파람)
      mouthFunnel: getBlendshape('mouthFunnel'),
    };
  }

  // 디버그 모드: AU 값 화면에 표시
  updateAUDisplay(auData, baseAU, getAUDelta) {
    const auDisplay = document.getElementById('au-display');
    const auValues = document.getElementById('au-values');
    if (!auDisplay || !auValues) return;

    auDisplay.classList.remove('hidden');

    // AU 임계값 정의 (실제 감점 임계값과 동기화)
    const thresholds = {
      browDown: { delta: 0.02, abs: 0.15 },
      smile: { delta: 0.15, abs: 0.35 },
      mouthPucker: { delta: 0.5, abs: 0.8 },   // 과하게 일그러졌을 때만
      mouthPress: { delta: 0.1, abs: 0.3 },
      eyeWide: { delta: 0.01, abs: 0.1 },
      mouthFrown: { delta: 0.1, abs: 0.25 },
      browInnerUp: { delta: 0.5, abs: 0.7 },   // 과하게 일그러졌을 때만
      mouthFunnel: { delta: 0.15, abs: 0.3 },
    };

    // AU 이름 매핑 (AU 번호만)
    const auNames = {
      browDown: 'AU4',
      smile: 'AU12',
      mouthPucker: 'AU18',
      mouthPress: 'AU24',
      eyeWide: 'AU5',
      mouthFrown: 'AU15',
      browInnerUp: 'AU1',
      mouthFunnel: 'AU22',
    };

    let html = '';
    for (const [key, name] of Object.entries(auNames)) {
      const delta = getAUDelta(key);
      const absValue = auData[key] || 0;
      const th = thresholds[key] || { delta: 0.15, abs: 0.3 };
      const isWarning = delta > th.delta || absValue > th.abs;
      const warningClass = isWarning ? 'warning' : '';
      // delta와 절대값 둘 다 표시
      html += `<div class="au-item ${warningClass}">
        <span class="au-name">${name}</span>
        <span class="au-value">${absValue.toFixed(2)}</span>
      </div>`;
    }
    auValues.innerHTML = html;
  }

  // 디버그 모드: 시선 정보 표시
  updateGazeDebug(gazeRatio, isGazeAway, currentYaw = 0) {
    const gazeDebug = document.getElementById('gaze-debug');
    const gazeInfo = document.getElementById('gaze-info');
    if (!gazeDebug || !gazeInfo) return;

    gazeDebug.classList.remove('hidden');

    if (!this.calibrationData) {
      gazeInfo.innerHTML = 'Calibrating...';
      return;
    }

    const baseX = this.calibrationData.baseGazeX || 0;
    const thresholdX = Math.max(this.GAZE_AWAY_THRESHOLD, (this.calibrationData.stdGazeX || 0) * 3);

    // 머리 회전 보정 (checkGazeAway와 동일한 로직)
    const yawFromBase = currentYaw - (this.calibrationData.baseYaw || 0);
    const expectedGazeShift = -yawFromBase * 0.004;
    const expectedGazeX = baseX + expectedGazeShift;

    const diffX = gazeRatio.avgX - expectedGazeX;
    const isXAway = Math.abs(diffX) > thresholdX;

    const xClass = isXAway ? 'gaze-warning' : 'gaze-ok';
    const statusClass = isGazeAway ? 'gaze-warning' : 'gaze-ok';

    // yaw 보정 정보 표시 (raw gaze, expected gaze, diff)
    const yawInfo = Math.abs(yawFromBase) > 1 ? ` yaw:${yawFromBase >= 0 ? '+' : ''}${yawFromBase.toFixed(0)}°` : '';
    gazeInfo.innerHTML = `gaze:${gazeRatio.avgX.toFixed(3)} exp:${expectedGazeX.toFixed(3)} ` +
                         `<span class="${xClass}">diff:${diffX >= 0 ? '+' : ''}${diffX.toFixed(3)}</span>/${thresholdX.toFixed(3)}${yawInfo} ` +
                         `[<span class="${statusClass}">${isGazeAway ? 'AWAY' : 'OK'}</span>]`;
  }

  // AU 기반 감점 계산 (penalty와 warnings 반환)
  // 캘리브레이션된 기준값 대비 변화량으로 판단
  calculateAUPenalty(auData) {
    let penalty = 0;
    const warnings = [];

    // 캘리브레이션 기준값 (없으면 0으로 처리)
    const baseAU = this.calibrationData?.baseAU || {};

    // AU 변화량 계산 함수 (현재값 - 기준값)
    const getAUDelta = (key) => auData[key] - (baseAU[key] || 0);

    // 임계값 초과 여부 확인 (delta 또는 절대값 기준)
    // deltaThreshold: 캘리브레이션 대비 변화량
    // absThreshold: 절대값 기준 (캘리브레이션 기준값이 이미 높을 때 대비)
    const exceedsThreshold = (key, deltaThreshold, absThreshold = null) => {
      const delta = getAUDelta(key);
      const absValue = auData[key] || 0;
      // delta가 임계값 초과 OR 절대값이 높은 경우
      if (absThreshold !== null) {
        return delta > deltaThreshold || absValue > absThreshold;
      }
      return delta > deltaThreshold;
    };

    // 디버그 모드: AU 값 화면에 표시
    if (this.debugMode) {
      this.updateAUDisplay(auData, baseAU, getAUDelta);
    }

    // AU4 - 눈썹 찌푸림 (피로 신호)
    // delta 0.02 또는 절대값 0.15 이상
    if (exceedsThreshold('browDown', 0.02, 0.15)) {
      penalty += 5;
      warnings.push(i18n.t('browDown'));
    }

    // AU12 - 부적절한 미소
    if (exceedsThreshold('smile', 0.15, 0.35) && auData.jawOpen < 0.2) {
      penalty += 8;
      warnings.push(i18n.t('smile'));
    }

    // AU18 - 입 오므림
    // delta 0.5 또는 절대값 0.8 이상 (과하게 일그러졌을 때만)
    if (exceedsThreshold('mouthPucker', 0.5, 0.8)) {
      penalty += 3;
      warnings.push(i18n.t('mouthPucker'));
    }

    // AU24 - 입술 누름 (긴장/스트레스)
    if (exceedsThreshold('mouthPress', 0.1, 0.3)) {
      penalty += 3;
      warnings.push(i18n.t('mouthPress'));
    }

    // AU5 - 눈 넓게 뜸 (산만/놀람)
    // delta 0.01 또는 절대값 0.1 이상
    if (exceedsThreshold('eyeWide', 0.01, 0.1)) {
      penalty += 5;
      warnings.push(i18n.t('eyeWide'));
    }

    // AU15 - 입꼬리 내림 (불만/지루함)
    if (exceedsThreshold('mouthFrown', 0.1, 0.25)) {
      penalty += 5;
      warnings.push(i18n.t('mouthFrown'));
    }

    // AU1 - 눈썹 안쪽 올림 (걱정/혼란)
    // delta 0.5 또는 절대값 0.7 이상 (과하게 일그러졌을 때만)
    if (exceedsThreshold('browInnerUp', 0.5, 0.7)) {
      penalty += 3;
      warnings.push(i18n.t('browInnerUp'));
    }

    // AU22 - 입 동그랗게 (딴 생각/휘파람)
    if (exceedsThreshold('mouthFunnel', 0.15, 0.3)) {
      penalty += 5;
      warnings.push(i18n.t('mouthFunnel'));
    }

    return { penalty: Math.min(penalty, 30), warnings }; // 최대 30점 감점
  }

  // 슬라이딩 윈도우 평균 점수 계산
  getAverageRecentScore() {
    const now = Date.now();
    // 5초 이내 점수만 유지
    this.recentScores = this.recentScores.filter(s => now - s.timestamp < this.SLIDING_WINDOW_MS);

    if (this.recentScores.length === 0) return 100;

    const sum = this.recentScores.reduce((acc, s) => acc + s.score, 0);
    return sum / this.recentScores.length;
  }

  handleUnfocus(score, warnings) {
    const faceNotDetected = warnings.includes(i18n.t('faceNotDetected'));

    // 슬라이딩 윈도우에 현재 점수 추가
    this.recentScores.push({ timestamp: Date.now(), score: score });

    // 최근 5초 평균으로 집중 저하 판단
    const avgScore = this.getAverageRecentScore();
    const isUnfocused = avgScore < this.UNFOCUS_THRESHOLD;

    // 비간섭 모드 (nonintrusive)
    if (this.currentMode === 'nonintrusive') {
      this.unfocusOverlay.classList.add('hidden'); // 오버레이 사용 안함

      // 팝업이 표시 중이면 집중 저하 타이머 중지
      if (this.isPopupShowing) {
        return;
      }

      const timeSinceLastPopup = Date.now() - this.lastPopupTime;

      // 디버그 로그 (매초)
      if (this.recentScores.length % 30 === 0) { // 약 0.5초마다
        console.log(`[비간섭] 현재: ${Math.round(score)}, 평균(5초): ${Math.round(avgScore)}, 임계값: ${this.UNFOCUS_THRESHOLD}, 쿨타임: ${Math.floor(timeSinceLastPopup/1000)}/${this.popupCooldown/1000}초`);
      }

      // 평균 점수가 임계값 미만 + 쿨타임 지남 → 팝업 표시
      if ((isUnfocused || faceNotDetected) && timeSinceLastPopup >= this.popupCooldown) {
        console.log(`[비간섭] 팝업 표시! 평균점수: ${Math.round(avgScore)}`);
        this.showFocusPopup();
      }
      return;
    }

    // 간섭 모드 (intrusive) - 경고음 + 자동 일시정지 + 집중도 회복 시 자동 재생
    if (this.currentMode === 'intrusive') {
      const RECOVERY_DURATION = 2000; // 2초간 집중 유지 시 재생
      const timeSinceLastPause = Date.now() - this.lastIntrusivePauseTime;

      // 얼굴 미감지 또는 집중도 저하 시
      if (faceNotDetected || isUnfocused) {
        // 회복 타이머 리셋
        this.focusRecoveryStart = null;

        // 아직 일시정지되지 않았고, 쿨타임이 지났으면 경고음 재생 후 일시정지
        if (!this.intrusivePaused && timeSinceLastPause >= this.popupCooldown) {
          this.intrusivePaused = true;
          this.lastIntrusivePauseTime = Date.now();
          this.playWarningSound();
          this.unfocusOverlay.classList.remove('hidden');
          this.learningVideo.controls = false; // 컨트롤 비활성화
          if (!this.learningVideo.paused) {
            this.learningVideo.pause();
          }
          console.log(`[간섭] 집중 저하 감지! 평균점수: ${Math.round(avgScore)}, 영상 일시정지`);
        }
      } else {
        // 집중도 회복 중
        if (this.intrusivePaused) {
          // 회복 시작 시간 기록
          if (!this.focusRecoveryStart) {
            this.focusRecoveryStart = Date.now();
            console.log(`[간섭] 집중도 회복 시작... ${RECOVERY_DURATION}ms간 유지 필요`);
          }

          // 3초간 집중 유지 확인
          const recoveryDuration = Date.now() - this.focusRecoveryStart;
          if (recoveryDuration >= RECOVERY_DURATION) {
            this.intrusivePaused = false;
            this.focusRecoveryStart = null;
            this.unfocusOverlay.classList.add('hidden');
            this.learningVideo.controls = true; // 컨트롤 다시 활성화
            if (this.learningVideo.paused && this.learningVideo.src) {
              this.learningVideo.play();
            }
            console.log(`[간섭] 집중도 회복 완료! 평균점수: ${Math.round(avgScore)}, 영상 재생`);
          }
        }
      }
      return;
    }

    // 일반 모드 - 기본 동작 (사용 안함)
    this.unfocusOverlay.classList.add('hidden');
  }

  // 비간섭 팝업 표시
  showFocusPopup() {
    if (this.isPopupShowing) return;

    this.isPopupShowing = true;
    this.unfocusStartTime = null;

    // 팝업 UI 업데이트
    document.getElementById('focus-popup-title').textContent = i18n.t('popupTitle');
    document.getElementById('popup-pause-btn').textContent = i18n.t('popupPause');
    document.getElementById('popup-continue-btn').textContent = i18n.t('popupContinue');

    this.focusPopup.classList.remove('hidden');
  }

  // 팝업 숨기기
  hideFocusPopup() {
    if (this.focusPopup) {
      this.focusPopup.classList.add('hidden');
    }
    this.isPopupShowing = false;
    // 쿨타임은 팝업이 닫힌 후부터 시작
    this.lastPopupTime = Date.now();
  }

  // 경고음 생성 (Web Audio API 사용)
  createWarningSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return audioContext;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      return null;
    }
  }

  // 경고음 재생
  playWarningSound() {
    if (!this.warningSound) return;

    try {
      const audioContext = this.warningSound;

      // AudioContext가 suspended 상태면 resume
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 경고음 설정: 짧은 비프음 2회
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);

      // 두 번째 비프음
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.frequency.value = 800;
        osc2.type = 'sine';

        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.15);
      }, 200);

      console.log('[간섭] 경고음 재생');
    } catch (e) {
      console.warn('경고음 재생 실패:', e);
    }
  }

  // "잠시 멈추겠습니다" 버튼 클릭
  handlePopupPause() {
    this.hideFocusPopup();
    this.learningVideo.pause();
    // 재생 버튼 표시하여 사용자가 직접 다시 시작할 수 있도록
    this.showResumeButton();
  }

  // 재생 재개 버튼 표시
  showResumeButton() {
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.textContent = `▶ ${i18n.t('resumeVideo')}`;
      resumeBtn.classList.remove('hidden');
    }
  }

  // 재생 재개 버튼 숨기기
  hideResumeButton() {
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.classList.add('hidden');
    }
  }

  // 재생 재개
  handleResume() {
    this.hideResumeButton();
    this.learningVideo.play();
    this.unfocusStartTime = null; // 집중 저하 타이머 리셋
  }

  // "아니요, 괜찮습니다" 버튼 클릭
  handlePopupContinue() {
    this.hideFocusPopup();
    // 영상 계속 재생 (변화 없음)
  }

  updateScore(score, warnings, auData = null) {
    this.scoreElement.textContent = Math.round(score);

    // Track focus score history (1초 간격으로 기록)
    if (this.isVideoPlaying && this.isCalibrated) {
      const currentTime = Date.now();
      if (currentTime - this.lastScoreTime >= this.SCORE_INTERVAL) {
        this.lastScoreTime = currentTime;

        const scoreEntry = {
          score: Math.round(score),
          timestamp: this.learningVideo.currentTime,
          recordedAt: new Date().toISOString(),
        };

        // AU 데이터가 있으면 포함
        if (auData) {
          scoreEntry.au = {
            browDown: Math.round(auData.browDown * 100) / 100,
            eyeSquint: Math.round(auData.eyeSquint * 100) / 100,
            smile: Math.round(auData.smile * 100) / 100,
            jawOpen: Math.round(auData.jawOpen * 100) / 100,
            eyeBlink: Math.round(auData.eyeBlink * 100) / 100,
            mouthPucker: Math.round(auData.mouthPucker * 100) / 100,
            mouthPress: Math.round(auData.mouthPress * 100) / 100,
            eyeWide: Math.round(auData.eyeWide * 100) / 100,
            mouthFrown: Math.round(auData.mouthFrown * 100) / 100,
            browInnerUp: Math.round(auData.browInnerUp * 100) / 100,
            mouthFunnel: Math.round(auData.mouthFunnel * 100) / 100,
          };
        }

        this.focusScoreHistory.push(scoreEntry);

        // AU 히스토리에도 별도 저장 (분석용)
        if (auData) {
          this.auHistory.push({
            timestamp: this.learningVideo.currentTime,
            ...auData
          });
        }
      }
    }

    if (this.debugScore) this.debugScore.classList.remove('high', 'medium', 'low');

    if (score >= 70) {
      if (this.debugScore) this.debugScore.classList.add('high');
    } else if (score >= 40) {
      if (this.debugScore) this.debugScore.classList.add('medium');
    } else {
      if (this.debugScore) this.debugScore.classList.add('low');
    }

    if (warnings.length === 0) {
      this.statusElement.innerHTML = `<span style="color: #4ade80;">${i18n.t('focusing')}</span>`;
    } else {
      this.statusElement.innerHTML = warnings
        .map(w => `<span class="warning-tag">${w}</span>`)
        .join(' ');
    }
  }

  drawLandmarks(results) {
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.faceLandmarks) {
      const videoWidth = this.cameraElement.videoWidth;
      const videoHeight = this.cameraElement.videoHeight;
      const canvasWidth = this.canvasElement.width;
      const canvasHeight = this.canvasElement.height;

      const videoAspect = videoWidth / videoHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      let scale, offsetX = 0, offsetY = 0;
      if (canvasAspect > videoAspect) {
        scale = canvasHeight / videoHeight;
        offsetX = (canvasWidth - videoWidth * scale) / 2;
      } else {
        scale = canvasWidth / videoWidth;
        offsetY = (canvasHeight - videoHeight * scale) / 2;
      }

      for (const landmarks of results.faceLandmarks) {
        const scaledLandmarks = landmarks.map(lm => ({
          x: (lm.x * videoWidth * scale + offsetX) / canvasWidth,
          y: (lm.y * videoHeight * scale + offsetY) / canvasHeight,
          z: lm.z
        }));

        // 테셀레이션 (흰색, 불투명)
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: 'rgba(255, 255, 255, 1)', lineWidth: 0.5 }
        );
        // 얼굴 윤곽선 (시스템 블루)
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );
        // 눈썹 (시스템 블루)
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );
        // 눈 (시스템 블루)
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );
        // 입술 (시스템 블루)
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_LIPS,
          { color: 'rgba(59, 130, 246, 1)', lineWidth: 2 }
        );

        // 홍채 (시스템 블루)
        this.drawIris(scaledLandmarks, LEFT_IRIS_INDICES, 'rgba(59, 130, 246, 1)');
        this.drawIris(scaledLandmarks, RIGHT_IRIS_INDICES, 'rgba(59, 130, 246, 1)');
      }
    }
  }

  drawIris(landmarks, indices, color) {
    const center = this.getIrisCenter(landmarks, indices);
    const x = center.x * this.canvasElement.width;
    const y = center.y * this.canvasElement.height;

    this.canvasCtx.beginPath();
    this.canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
    this.canvasCtx.fillStyle = color;
    this.canvasCtx.fill();
  }

  // Subtitle methods
  async loadSubtitles(videoName) {
    this.subtitleCues = [];
    this.hideSubtitle();

    try {
      const response = await fetch(`/videos/${encodeURIComponent(videoName)}/subtitle.ttml`);
      if (!response.ok) {
        console.log('No subtitle file found for this video');
        this.subtitleToggle.classList.add('hidden');
        return;
      }

      const ttmlText = await response.text();
      this.subtitleCues = this.parseTTML(ttmlText);
      this.subtitleToggle.classList.remove('hidden');

      // Auto-enable subtitles for Korean, otherwise off by default
      if (i18n.getLang() === 'ko') {
        this.selectSubtitleLang('ko');
      } else {
        this.selectSubtitleLang('off');
      }
    } catch (error) {
      console.error('Failed to load subtitles:', error);
      this.subtitleToggle.classList.add('hidden');
    }
  }

  parseTTML(ttmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ttmlText, 'text/xml');
    const cues = [];

    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach(p => {
      const begin = this.parseTime(p.getAttribute('begin'));
      const end = this.parseTime(p.getAttribute('end'));
      // Get innerHTML and convert <br> to newlines, then strip other tags
      let text = p.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      if (begin !== null && end !== null && text) {
        cues.push({ begin, end, text });
      }
    });

    return cues;
  }

  parseTime(timeStr) {
    if (!timeStr) return null;

    // Format: HH:MM:SS.mmm or MM:SS.mmm
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    }
    return null;
  }

  toggleSubtitleMenu() {
    this.subtitleMenu.classList.toggle('hidden');
  }

  toggleMobileSubtitleMenu() {
    this.mobileSubtitleMenu.classList.toggle('hidden');
  }

  selectSubtitleLang(lang) {
    this.currentSubtitleLang = lang;
    this.subtitleEnabled = lang !== 'off';

    // Update menu UI (both desktop and mobile)
    this.subtitleMenu.querySelectorAll('.subtitle-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    this.mobileSubtitleMenu.querySelectorAll('.subtitle-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update toggle buttons
    this.subtitleToggle.classList.toggle('active', this.subtitleEnabled);
    this.mobileSubtitleToggle.classList.toggle('active', this.subtitleEnabled);

    // Hide menus
    this.subtitleMenu.classList.add('hidden');
    this.mobileSubtitleMenu.classList.add('hidden');

    // Update subtitle display
    if (!this.subtitleEnabled) {
      this.hideSubtitle();
    } else {
      this.updateSubtitle();
    }
  }

  updateSubtitle() {
    if (!this.subtitleEnabled || this.subtitleCues.length === 0) {
      this.hideSubtitle();
      return;
    }

    const currentTime = this.learningVideo.currentTime;
    const activeCue = this.subtitleCues.find(
      cue => currentTime >= cue.begin && currentTime <= cue.end
    );

    if (activeCue) {
      this.showSubtitle(activeCue.text);
    } else {
      this.hideSubtitle();
    }
  }

  showSubtitle(text) {
    const formattedText = text.replace(/\n/g, '<br>');
    // Desktop overlay subtitle
    this.subtitleText.innerHTML = formattedText;
    this.customSubtitle.classList.remove('hidden');
    // Mobile subtitle area
    this.mobileSubtitleText.innerHTML = formattedText;
    this.mobileSubtitleArea.classList.remove('hidden');
  }

  hideSubtitle() {
    // Desktop overlay subtitle
    this.customSubtitle.classList.add('hidden');
    this.subtitleText.textContent = '';
    // Mobile subtitle area
    this.mobileSubtitleArea.classList.add('hidden');
    this.mobileSubtitleText.textContent = '';
  }

  toggleDebug() {
    this.debugMode = !this.debugMode;
    const videoContainer = document.getElementById('video-container');
    const sidePanel = document.getElementById('side-panel');
    const debugOverlay = document.getElementById('debug-overlay');

    if (this.debugMode) {
      // 디버그 모드 활성화: debug-overlay, side-panel 표시
      debugOverlay.classList.remove('hidden');
      sidePanel.classList.remove('hidden');
      this.learningVideo.classList.remove('active');
      this.videoPlaceholder.classList.add('hidden');
      this.cameraContainer.classList.remove('hidden');
      this.cameraContainer.classList.add('fullscreen');
      videoContainer.appendChild(this.cameraContainer);
    } else {
      // 디버그 모드 비활성화: debug-overlay, side-panel 숨김
      debugOverlay.classList.add('hidden');
      sidePanel.classList.add('hidden');
      // AU 디스플레이 숨김
      const auDisplay = document.getElementById('au-display');
      if (auDisplay) auDisplay.classList.add('hidden');
      if (this.learningVideo.src) {
        this.learningVideo.classList.add('active');
      } else {
        this.videoPlaceholder.classList.remove('hidden');
      }
      this.cameraContainer.classList.remove('fullscreen');
      this.cameraContainer.classList.add('hidden');
      sidePanel.appendChild(this.cameraContainer);
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
  }

  // Survey methods
  async loadSurveyData() {
    if (this.surveyData) return;

    try {
      const response = await fetch('/surveys.json');
      this.surveyData = await response.json();
    } catch (error) {
      console.error('Failed to load survey data:', error);
      this.surveyData = null;
    }
  }

  async showSurveyPage() {
    await this.loadSurveyData();

    if (!this.surveyData) {
      this.showListPage();
      return;
    }

    // Determine which sections to show based on mode
    this.surveySections = [...this.surveyData.common.sections];

    // Add intrusive mode sections if applicable (strict_mode in survey data)
    if (this.currentMode === 'intrusive') {
      this.surveySections.push(...this.surveyData.strict_mode.sections);
    }

    this.currentSurveySection = 0;
    this.surveyResponses = {};

    // Hide other pages
    this.listPage.classList.add('hidden');
    this.watchPage.classList.add('hidden');
    this.quizPage.classList.add('hidden');
    this.surveyPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');

    // Update UI
    this.updateSurveyUI();
    this.renderSurveySection();
  }

  updateSurveyUI() {
    const lang = i18n.getLang();

    // Set title and description based on mode
    if (this.currentMode === 'intrusive') {
      document.getElementById('survey-title').textContent = this.surveyData.strict_mode.title[lang];
      document.getElementById('survey-description').textContent = this.surveyData.strict_mode.description[lang];
    } else {
      document.getElementById('survey-title').textContent = this.surveyData.common.title[lang];
      document.getElementById('survey-description').textContent = this.surveyData.common.description[lang];
    }

    // Update progress
    document.getElementById('survey-total-sections').textContent = this.surveySections.length;

    // Update button text
    document.getElementById('survey-prev-btn').textContent = lang === 'ko' ? '이전' : 'Previous';
    document.getElementById('survey-next-btn').textContent = lang === 'ko' ? '다음' : 'Next';
    document.getElementById('survey-finish-btn').textContent = lang === 'ko' ? '목록으로 돌아가기' : 'Back to List';
    document.getElementById('survey-complete-title').textContent = lang === 'ko' ? '설문이 완료되었습니다' : 'Survey Completed';
    document.getElementById('survey-complete-message').textContent = lang === 'ko' ? '소중한 피드백 감사합니다!' : 'Thank you for your feedback!';
  }

  renderSurveySection() {
    const section = this.surveySections[this.currentSurveySection];
    const lang = i18n.getLang();
    const likertLabels = this.surveyData.likert_labels[lang];

    // Update progress
    document.getElementById('survey-current-section').textContent = this.currentSurveySection + 1;
    const progressPercent = ((this.currentSurveySection + 1) / this.surveySections.length) * 100;
    document.getElementById('survey-progress-fill').style.width = `${progressPercent}%`;

    // Update section title
    document.getElementById('survey-section-title').textContent = section.title[lang];

    // Render questions
    const questionsContainer = document.getElementById('survey-questions');
    questionsContainer.innerHTML = section.questions.map(q => `
      <div class="survey-question" data-question-id="${q.id}">
        <p class="survey-question-text">${q.text[lang]}</p>
        <div class="likert-scale">
          ${Array.from({ length: q.scale }, (_, i) => {
            const value = i + 1;
            const isSelected = this.surveyResponses[q.id] === value;
            return `
              <label class="likert-option ${isSelected ? 'selected' : ''}">
                <input type="radio" name="${q.id}" value="${value}" ${isSelected ? 'checked' : ''}>
                <span class="likert-circle">${value}</span>
                <span class="likert-label">${likertLabels[i]}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    // Add change listeners
    questionsContainer.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const questionId = e.target.name;
        const value = parseInt(e.target.value, 10);
        this.surveyResponses[questionId] = value;

        // Update visual selection
        const questionDiv = e.target.closest('.survey-question');
        questionDiv.querySelectorAll('.likert-option').forEach(opt => {
          opt.classList.toggle('selected', opt.querySelector('input').checked);
        });
      });
    });

    // Update navigation buttons
    const prevBtn = document.getElementById('survey-prev-btn');
    const nextBtn = document.getElementById('survey-next-btn');

    prevBtn.disabled = this.currentSurveySection === 0;

    const isLastSection = this.currentSurveySection === this.surveySections.length - 1;
    nextBtn.textContent = isLastSection
      ? (i18n.getLang() === 'ko' ? '완료' : 'Complete')
      : (i18n.getLang() === 'ko' ? '다음' : 'Next');
  }

  navigateSurvey(direction) {
    // Validate current section before moving forward
    if (direction > 0) {
      const section = this.surveySections[this.currentSurveySection];
      const unanswered = section.questions.filter(q => !this.surveyResponses[q.id]);

      if (unanswered.length > 0) {
        // Highlight unanswered questions
        unanswered.forEach(q => {
          const questionDiv = document.querySelector(`[data-question-id="${q.id}"]`);
          if (questionDiv) {
            questionDiv.classList.add('unanswered');
            setTimeout(() => questionDiv.classList.remove('unanswered'), 2000);
          }
        });
        return;
      }
    }

    const newIndex = this.currentSurveySection + direction;

    if (newIndex < 0) return;

    if (newIndex >= this.surveySections.length) {
      // Survey complete
      this.completeSurvey();
      return;
    }

    this.currentSurveySection = newIndex;
    this.renderSurveySection();
  }

  completeSurvey() {
    // 설문 응답 임시 저장 (퀴즈 후 최종 전송)
    this.tempSurveyResponses = { ...this.surveyResponses };

    // Reset survey UI for next use
    document.querySelector('.survey-content').classList.remove('hidden');
    document.querySelector('.survey-navigation').classList.remove('hidden');
    document.getElementById('survey-complete').classList.add('hidden');

    // 설문 완료 후 퀴즈로 이동
    this.showQuizPage();
  }

  saveSurveyResults() {
    const results = {
      timestamp: new Date().toISOString(),
      mode: this.currentMode,
      videoName: this.currentVideoName,
      quizScore: this.quizScore,
      surveyResponses: this.surveyResponses
    };

    // Get existing results or create new array
    const existingResults = JSON.parse(localStorage.getItem('focus-survey-results') || '[]');
    existingResults.push(results);
    localStorage.setItem('focus-survey-results', JSON.stringify(existingResults));
  }

  // 설문 점수 계산 (섹션별 평균, 역문항 처리 포함)
  calculateSurveyScores(responses) {
    if (!this.surveyData || !responses) return null;

    const allSections = [...this.surveyData.common.sections];
    if (this.currentMode === 'intrusive') {
      allSections.push(...this.surveyData.strict_mode.sections);
    }

    const sectionScores = {};
    const categoryScores = {};

    // 섹션별 점수 계산
    allSections.forEach(section => {
      const sectionId = section.id;
      let totalScore = 0;
      let answeredCount = 0;

      section.questions.forEach(q => {
        if (responses[q.id] !== undefined) {
          let score = responses[q.id];
          // 역문항 처리 (1↔5, 2↔4, 3=3)
          if (q.reversed) {
            score = 6 - score;
          }
          totalScore += score;
          answeredCount++;
        }
      });

      if (answeredCount > 0) {
        const avgScore = totalScore / answeredCount;
        sectionScores[sectionId] = {
          average: Math.round(avgScore * 100) / 100,
          total: totalScore,
          count: answeredCount,
          maxPossible: answeredCount * 5
        };
      }
    });

    // 상위 카테고리 점수 계산
    // Common 섹션: UX Engagement (FA, PU, RW) + Cognitive Load (IL, EL, GL)
    const uxEngagementSections = ['focused_attention', 'perceived_usability', 'reward_factor'];
    const cognitiveLoadSections = ['intrinsic_load', 'extraneous_load', 'germane_load'];
    const strictModeSections = ['disturbance', 'helpfulness', 'control', 'overall_strict'];

    // UX Engagement 종합 점수
    const uxScores = uxEngagementSections
      .filter(id => sectionScores[id])
      .map(id => sectionScores[id].average);
    if (uxScores.length > 0) {
      categoryScores.ux_engagement = {
        average: Math.round((uxScores.reduce((a, b) => a + b, 0) / uxScores.length) * 100) / 100,
        sections: uxEngagementSections.filter(id => sectionScores[id])
      };
    }

    // Cognitive Load 종합 점수
    const clScores = cognitiveLoadSections
      .filter(id => sectionScores[id])
      .map(id => sectionScores[id].average);
    if (clScores.length > 0) {
      categoryScores.cognitive_load = {
        average: Math.round((clScores.reduce((a, b) => a + b, 0) / clScores.length) * 100) / 100,
        sections: cognitiveLoadSections.filter(id => sectionScores[id])
      };
    }

    // Strict Mode (Intrusive) 종합 점수
    if (this.currentMode === 'intrusive') {
      const strictScores = strictModeSections
        .filter(id => sectionScores[id])
        .map(id => sectionScores[id].average);
      if (strictScores.length > 0) {
        categoryScores.strict_mode_feedback = {
          average: Math.round((strictScores.reduce((a, b) => a + b, 0) / strictScores.length) * 100) / 100,
          sections: strictModeSections.filter(id => sectionScores[id])
        };
      }
    }

    // 전체 종합 점수
    const allAvgScores = Object.values(sectionScores).map(s => s.average);
    const overallAverage = allAvgScores.length > 0
      ? Math.round((allAvgScores.reduce((a, b) => a + b, 0) / allAvgScores.length) * 100) / 100
      : 0;

    return {
      sectionScores,
      categoryScores,
      overallAverage,
      // 퍼센트 환산 (5점 만점 → 100점 환산)
      overallPercent: Math.round((overallAverage / 5) * 100)
    };
  }

  // 설문 결과 포맷팅 (이메일용)
  formatSurveyResultsForEmail(surveyScores) {
    if (!surveyScores) return '설문 데이터 없음';

    const lang = i18n.getLang();
    const lines = [];

    // 섹션 이름 매핑
    const sectionNames = {
      focused_attention: lang === 'ko' ? '집중적 주의 (FA)' : 'Focused Attention (FA)',
      perceived_usability: lang === 'ko' ? '지각된 사용성 (PU)' : 'Perceived Usability (PU)',
      reward_factor: lang === 'ko' ? '보상 요인 (RW)' : 'Reward Factor (RW)',
      intrinsic_load: lang === 'ko' ? '내재적 부하 (IL)' : 'Intrinsic Load (IL)',
      extraneous_load: lang === 'ko' ? '외재적 부하 (EL)' : 'Extraneous Load (EL)',
      germane_load: lang === 'ko' ? '본질적 부하 (GL)' : 'Germane Load (GL)',
      disturbance: lang === 'ko' ? '방해 정도' : 'Disturbance',
      helpfulness: lang === 'ko' ? '도움 정도' : 'Helpfulness',
      control: lang === 'ko' ? '통제감' : 'Sense of Control',
      overall_strict: lang === 'ko' ? '종합 평가' : 'Overall Assessment'
    };

    lines.push('='.repeat(40));
    lines.push(lang === 'ko' ? '📊 설문 결과 요약' : '📊 Survey Results Summary');
    lines.push('='.repeat(40));
    lines.push('');

    // 전체 점수
    lines.push(lang === 'ko'
      ? `▶ 종합 점수: ${surveyScores.overallAverage}/5.00 (${surveyScores.overallPercent}%)`
      : `▶ Overall Score: ${surveyScores.overallAverage}/5.00 (${surveyScores.overallPercent}%)`);
    lines.push('');

    // 카테고리별 점수
    if (surveyScores.categoryScores.ux_engagement) {
      lines.push(lang === 'ko'
        ? `📌 UX 몰입도: ${surveyScores.categoryScores.ux_engagement.average}/5.00`
        : `📌 UX Engagement: ${surveyScores.categoryScores.ux_engagement.average}/5.00`);
    }
    if (surveyScores.categoryScores.cognitive_load) {
      lines.push(lang === 'ko'
        ? `📌 인지 부하: ${surveyScores.categoryScores.cognitive_load.average}/5.00`
        : `📌 Cognitive Load: ${surveyScores.categoryScores.cognitive_load.average}/5.00`);
    }
    if (surveyScores.categoryScores.strict_mode_feedback) {
      lines.push(lang === 'ko'
        ? `📌 간섭 모드 피드백: ${surveyScores.categoryScores.strict_mode_feedback.average}/5.00`
        : `📌 Intrusive Mode Feedback: ${surveyScores.categoryScores.strict_mode_feedback.average}/5.00`);
    }
    lines.push('');

    // 섹션별 상세
    lines.push('-'.repeat(40));
    lines.push(lang === 'ko' ? '📋 섹션별 상세 점수' : '📋 Section Details');
    lines.push('-'.repeat(40));

    Object.entries(surveyScores.sectionScores).forEach(([sectionId, data]) => {
      const name = sectionNames[sectionId] || sectionId;
      const bar = this.generateScoreBar(data.average, 5);
      lines.push(`${name}`);
      lines.push(`  ${bar} ${data.average}/5.00`);
    });

    return lines.join('\n');
  }

  // 점수 시각화 바 생성
  generateScoreBar(score, maxScore) {
    const percent = (score / maxScore) * 100;
    const filledBlocks = Math.round(percent / 10);
    const emptyBlocks = 10 - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  }

  handleBack() {
    if (!this.resultPage.classList.contains('hidden')) {
      this.showListPage();
    } else if (!this.surveyPage.classList.contains('hidden')) {
      this.showListPage();
    } else if (!this.quizPage.classList.contains('hidden')) {
      this.showListPage();
    } else {
      this.showListPage();
    }
  }

  showResultPage() {
    const lang = i18n.getLang();

    // Hide other pages
    this.listPage.classList.add('hidden');
    this.watchPage.classList.add('hidden');
    this.quizPage.classList.add('hidden');
    this.surveyPage.classList.add('hidden');
    this.resultPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');

    // Update result summary
    document.getElementById('result-title').textContent = lang === 'ko' ? '학습 완료' : 'Learning Complete';
    document.getElementById('result-description').textContent = lang === 'ko' ? '학습 결과가 제출됩니다' : 'Your results are being submitted';
    document.getElementById('result-video-label').textContent = lang === 'ko' ? '시청 영상' : 'Video';
    document.getElementById('result-mode-label').textContent = lang === 'ko' ? '학습 모드' : 'Mode';
    document.getElementById('result-focus-label').textContent = lang === 'ko' ? '평균 집중 점수' : 'Avg Focus Score';
    document.getElementById('result-quiz-label').textContent = lang === 'ko' ? '퀴즈 점수' : 'Quiz Score';
    document.getElementById('result-survey-label').textContent = lang === 'ko' ? '설문 완료' : 'Survey';
    document.getElementById('back-to-list-btn').textContent = lang === 'ko' ? '목록으로 돌아가기' : 'Back to List';

    document.getElementById('result-video-name').textContent = this.currentVideoName || '-';
    document.getElementById('result-mode-name').textContent = this.getModeDisplayName(this.currentMode);
    document.getElementById('result-focus-score').textContent = `${this.averageFocusScore}/100`;
    document.getElementById('result-quiz-score').textContent = `${this.quizScore}/100`;
    document.getElementById('result-survey-status').textContent = '✓';

    // Reset UI states
    document.getElementById('result-sending').classList.remove('hidden');
    document.getElementById('result-success').classList.add('hidden');
    document.getElementById('result-error').classList.add('hidden');
    document.getElementById('back-to-list-btn').classList.add('hidden');

    // Send results via email
    this.sendResultsEmail();
  }

  getModeDisplayName(mode) {
    const lang = i18n.getLang();
    const modeNames = {
      normal: lang === 'ko' ? '일반' : 'Normal',
      nonintrusive: lang === 'ko' ? '비간섭' : 'Non-Intrusive',
      intrusive: lang === 'ko' ? '간섭' : 'Intrusive'
    };
    return modeNames[mode] || mode;
  }

  async sendResultsEmail() {
    const lang = i18n.getLang();

    // 참가자 이름 가져오기
    const participantName = document.getElementById('participant-name')?.value?.trim() || 'Anonymous';

    // AU 통계 계산
    const auStats = this.calculateAUStats();

    // 설문 점수 계산
    const surveyScores = this.calculateSurveyScores(this.tempSurveyResponses);
    const surveyFormatted = this.formatSurveyResultsForEmail(surveyScores);

    const results = {
      timestamp: new Date().toISOString(),
      participantName: participantName,
      mode: this.currentMode,
      videoName: this.currentVideoName,
      quizScore: this.quizScore,
      averageFocusScore: this.averageFocusScore,
      focusScoreHistory: this.focusScoreHistory,
      auHistory: this.auHistory,
      auStats: auStats,
      surveyResponses: this.tempSurveyResponses,
      surveyScores: surveyScores
    };

    // Save locally first
    this.saveResultsLocally(results);

    // Try to send via EmailJS
    if (typeof emailjs !== 'undefined') {
      try {
        // 이메일용 경량 데이터 (50KB 제한)
        const templateParams = {
          to_email: '99jik@99jik.com',
          subject: `[FOCUS] ${participantName} - ${this.currentVideoName}`,
          participant_name: participantName,
          video_name: this.currentVideoName,
          mode: this.getModeDisplayName(this.currentMode),
          quiz_score: `${this.quizScore}/100`,
          focus_score: Math.round(this.averageFocusScore),
          // 설문 결과 (포맷된 텍스트)
          survey_summary: surveyFormatted,
          // 설문 종합 점수
          survey_overall: surveyScores ? `${surveyScores.overallAverage}/5.00 (${surveyScores.overallPercent}%)` : 'N/A',
          // UX 몰입도 점수
          survey_ux: surveyScores?.categoryScores?.ux_engagement ? `${surveyScores.categoryScores.ux_engagement.average}/5.00` : 'N/A',
          // 인지 부하 점수
          survey_cl: surveyScores?.categoryScores?.cognitive_load ? `${surveyScores.categoryScores.cognitive_load.average}/5.00` : 'N/A',
          // 간섭 모드 피드백 (해당 시)
          survey_strict: surveyScores?.categoryScores?.strict_mode_feedback ? `${surveyScores.categoryScores.strict_mode_feedback.average}/5.00` : 'N/A',
          // 설문 원본 응답 (간결하게)
          survey_responses: JSON.stringify(this.tempSurveyResponses),
          timestamp: new Date().toLocaleString('ko-KR'),
          // AU 통계 요약 (대용량 히스토리 제외)
          au_stats: auStats ? JSON.stringify(auStats) : 'N/A'
        };

        await emailjs.send(
          'service_yu4cjdg',  // EmailJS Service ID
          'template_c5i5ejm', // EmailJS Template ID
          templateParams
        );

        // Success
        document.getElementById('result-sending').classList.add('hidden');
        document.getElementById('result-success').classList.remove('hidden');
        document.getElementById('result-success-text').textContent =
          lang === 'ko' ? '결과가 성공적으로 전송되었습니다' : 'Results sent successfully';
      } catch (error) {
        console.error('EmailJS error:', error);
        document.getElementById('result-sending').classList.add('hidden');
        document.getElementById('result-error').classList.remove('hidden');
        document.getElementById('result-error-text').textContent =
          lang === 'ko' ? '전송 실패. 로컬에 저장되었습니다.' : 'Send failed. Saved locally.';
      }
    } else {
      // EmailJS not available
      document.getElementById('result-sending').classList.add('hidden');
      document.getElementById('result-error').classList.remove('hidden');
      document.getElementById('result-error-text').textContent =
        lang === 'ko' ? 'EmailJS 미설정. 로컬에 저장되었습니다.' : 'EmailJS not configured. Saved locally.';
    }

    // Show back button
    document.getElementById('back-to-list-btn').classList.remove('hidden');
  }

  saveResultsLocally(results) {
    const existingResults = JSON.parse(localStorage.getItem('focus-results') || '[]');
    existingResults.push(results);
    localStorage.setItem('focus-results', JSON.stringify(existingResults));
    console.log('Results saved locally:', results);
  }

  showListPage() {
    this.stopAnalysis();
    this.listPage.classList.remove('hidden');
    this.watchPage.classList.add('hidden');
    this.quizPage.classList.add('hidden');
    this.surveyPage.classList.add('hidden');
    this.resultPage.classList.add('hidden');
    this.backBtn.classList.add('hidden');
    this.debugToggle.classList.add('hidden');

    this.learningVideo.pause();
    this.learningVideo.src = '';
    this.learningVideo.classList.remove('active');
    this.videoPlaceholder.classList.remove('hidden');
    this.playVideoBtn.classList.add('hidden');
    document.getElementById('side-panel').classList.remove('hidden');

    // Reset subtitle state
    this.subtitleCues = [];
    this.hideSubtitle();
    this.subtitleEnabled = false;
    this.currentSubtitleLang = 'off';
    this.subtitleToggle.classList.remove('active');

    // Reset survey state
    document.querySelector('.survey-content').classList.remove('hidden');
    document.querySelector('.survey-navigation').classList.remove('hidden');
    document.getElementById('survey-complete').classList.add('hidden');

    this.currentVideoName = null;
    this.quizData = null;
    this.isVideoPlaying = false;
    this.faceDetected = false;
    this.surveyResponses = {};
    this.currentSurveySection = 0;

    this.renderVideoList();
  }
}

new FocusApp();
