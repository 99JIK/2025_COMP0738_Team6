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

    this.isCalibrated = false;
    this.calibrationData = null;
    this.calibrationFrames = [];
    this.CALIBRATION_FRAME_COUNT = 30;

    this.GAZE_AWAY_THRESHOLD = 0.12;
    this.UNFOCUS_THRESHOLD = 50;

    this.scoreElement = document.getElementById('score-value');
    this.statusElement = document.getElementById('status-text');
    this.scoreCircle = document.querySelector('.score-circle');
    this.playVideoBtn = document.getElementById('play-video-btn');

    this.init();
  }

  async init() {
    try {
      this.debugToggle.addEventListener('click', () => this.toggleDebug());
      this.backBtn.addEventListener('click', () => this.handleBack());
      this.langToggle.addEventListener('click', () => this.toggleLanguage());
      document.getElementById('back-to-list-btn').addEventListener('click', () => this.showListPage());
      this.playVideoBtn.addEventListener('click', () => this.startVideoPlayback());

      this.learningVideo.addEventListener('ended', () => this.onVideoEnded());

      this.modeModal.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
      });

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
    document.getElementById('mode-nocontrol-name').textContent = i18n.t('modeNoControl');
    document.getElementById('mode-nocontrol-desc').textContent = i18n.t('modeNoControlDesc');
    document.getElementById('mode-scoreonly-name').textContent = i18n.t('modeScoreOnly');
    document.getElementById('mode-scoreonly-desc').textContent = i18n.t('modeScoreOnlyDesc');
    document.getElementById('mode-strict-name').textContent = i18n.t('modeStrict');
    document.getElementById('mode-strict-desc').textContent = i18n.t('modeStrictDesc');
  }

  selectMode(mode) {
    this.currentMode = mode;
    const videoIndex = this.pendingVideoIndex;
    this.hideModeModal();

    if (videoIndex !== null) {
      this.startWatchingVideo(videoIndex);
    }
  }

  handleBack() {
    if (!this.quizPage.classList.contains('hidden')) {
      this.showListPage();
    } else {
      this.showListPage();
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

    this.videoList.innerHTML = this.videos.map((videoName, index) => `
      <div class="video-item" data-index="${index}">
        <div class="video-thumbnail">&#9658;</div>
        <div class="video-info">
          <div class="video-name">${videoName}</div>
        </div>
        <div class="video-actions">
          <button class="watch-btn" data-index="${index}">${i18n.t('watch')}</button>
        </div>
      </div>
    `).join('');

    this.videoList.querySelectorAll('.watch-btn').forEach(btn => {
      btn.addEventListener('click', () => this.watchVideo(parseInt(btn.dataset.index)));
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
    this.baseVolume = 1.0;
    this.learningVideo.volume = this.baseVolume;

    this.applyModeSettings();
    this.showWatchPage();

    if (this.currentMode === 'normal' || this.currentMode === 'nocontrol') {
      this.startSimpleMode();
    } else {
      this.startFaceDetection();
    }
  }

  startSimpleMode() {
    this.videoPlaceholder.classList.add('hidden');
    this.learningVideo.classList.add('active');
    document.getElementById('side-panel').classList.add('hidden');
    this.learningVideo.play();
  }

  applyModeSettings() {
    if (this.currentMode === 'normal') {
      this.learningVideo.controls = true;
    } else {
      this.learningVideo.controls = false;
    }
  }

  async startFaceDetection() {
    try {
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

          if (this.currentMode === 'strict') {
            this.startVideoPlayback();
            return;
          }

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

    this.learningVideo.classList.add('active');
    this.videoPlaceholder.classList.add('hidden');
    this.learningVideo.play();

    this.statusElement.textContent = i18n.t('lookAtCamera');
    this.processFrame();
  }

  async onVideoEnded() {
    this.stopAnalysis();
    await this.loadQuiz();
    this.showQuizPage();
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
    this.quizPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');
    this.debugToggle.classList.add('hidden');

    document.getElementById('quiz-title').textContent = i18n.t('quiz');
    document.getElementById('quiz-total').textContent = '10';
    document.getElementById('back-to-list-btn').textContent = i18n.t('backToList');
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

    document.getElementById('result-score-value').textContent = this.quizScore;
  }

  showListPage() {
    this.stopAnalysis();
    this.listPage.classList.remove('hidden');
    this.watchPage.classList.add('hidden');
    this.quizPage.classList.add('hidden');
    this.backBtn.classList.add('hidden');
    this.debugToggle.classList.add('hidden');

    this.learningVideo.pause();
    this.learningVideo.src = '';
    this.learningVideo.classList.remove('active');
    this.videoPlaceholder.classList.remove('hidden');
    this.playVideoBtn.classList.add('hidden');
    document.getElementById('side-panel').classList.remove('hidden');

    this.currentVideoName = null;
    this.quizData = null;
    this.isVideoPlaying = false;
    this.faceDetected = false;

    this.renderVideoList();
  }

  showWatchPage() {
    this.listPage.classList.add('hidden');
    this.watchPage.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');
    this.debugToggle.classList.remove('hidden');
    this.videoPlaceholder.classList.remove('hidden');
    this.learningVideo.classList.remove('active');
    this.statusElement.textContent = i18n.t('detectingFace');
  }

  toggleLanguage() {
    i18n.toggleLang();
    this.updateLanguageUI();
    this.renderVideoList();
  }

  updateLanguageUI() {
    this.langIcon.textContent = i18n.getLang() === 'ko' ? 'EN' : 'KO';

    document.getElementById('list-title').textContent = i18n.t('videoList');
    document.getElementById('unfocus-message').textContent = i18n.t('focusPlease');
    this.playVideoBtn.textContent = i18n.t('playVideo');

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

      if (!this.isCalibrated) {
        this.calibrate(results);
      } else {
        this.analyzeResults(results);
      }

      if (this.debugMode) {
        this.drawLandmarks(results);
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

  checkGazeAway(gazeRatio) {
    const thresholdX = Math.max(this.GAZE_AWAY_THRESHOLD, this.calibrationData.stdGazeX * 3);
    const thresholdY = Math.max(this.GAZE_AWAY_THRESHOLD, this.calibrationData.stdGazeY * 3);

    const gazeDiffX = Math.abs(gazeRatio.avgX - this.calibrationData.baseGazeX);
    const gazeDiffY = Math.abs(gazeRatio.avgY - this.calibrationData.baseGazeY);

    return gazeDiffX > thresholdX || gazeDiffY > thresholdY;
  }

  getGazeRatio(landmarks) {
    const leftIris = this.getIrisCenter(landmarks, LEFT_IRIS_INDICES);
    const rightIris = this.getIrisCenter(landmarks, RIGHT_IRIS_INDICES);

    const leftEyeWidth = Math.abs(landmarks[LEFT_EYE_OUTER].x - landmarks[LEFT_EYE_INNER].x);
    const rightEyeWidth = Math.abs(landmarks[RIGHT_EYE_OUTER].x - landmarks[RIGHT_EYE_INNER].x);
    const leftEyeHeight = Math.abs(landmarks[LEFT_EYE_TOP].y - landmarks[LEFT_EYE_BOTTOM].y);
    const rightEyeHeight = Math.abs(landmarks[RIGHT_EYE_TOP].y - landmarks[RIGHT_EYE_BOTTOM].y);

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
      avgY: (leftRatioY + rightRatioY) / 2
    };
  }

  calibrate(results) {
    if (!results.facialTransformationMatrixes || results.facialTransformationMatrixes.length === 0 ||
        !results.faceLandmarks || results.faceLandmarks.length === 0) {
      this.statusElement.textContent = i18n.t('showFaceToCamera');
      return;
    }

    const matrix = results.facialTransformationMatrixes[0].data;
    const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
    const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8] * matrix[8] + matrix[10] * matrix[10])) * (180 / Math.PI);
    const roll = Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI);

    const landmarks = results.faceLandmarks[0];
    const gazeRatio = this.getGazeRatio(landmarks);

    this.calibrationFrames.push({ yaw, pitch, roll, gazeX: gazeRatio.avgX, gazeY: gazeRatio.avgY });

    const progress = Math.round((this.calibrationFrames.length / this.CALIBRATION_FRAME_COUNT) * 100);
    this.statusElement.textContent = `${i18n.t('calibrating')} ${progress}%`;

    if (this.calibrationFrames.length >= this.CALIBRATION_FRAME_COUNT) {
      const avgYaw = this.calibrationFrames.reduce((sum, f) => sum + f.yaw, 0) / this.calibrationFrames.length;
      const avgPitch = this.calibrationFrames.reduce((sum, f) => sum + f.pitch, 0) / this.calibrationFrames.length;
      const avgRoll = this.calibrationFrames.reduce((sum, f) => sum + f.roll, 0) / this.calibrationFrames.length;
      const avgGazeX = this.calibrationFrames.reduce((sum, f) => sum + f.gazeX, 0) / this.calibrationFrames.length;
      const avgGazeY = this.calibrationFrames.reduce((sum, f) => sum + f.gazeY, 0) / this.calibrationFrames.length;

      const stdGazeX = Math.sqrt(
        this.calibrationFrames.reduce((sum, f) => sum + Math.pow(f.gazeX - avgGazeX, 2), 0) / this.calibrationFrames.length
      );
      const stdGazeY = Math.sqrt(
        this.calibrationFrames.reduce((sum, f) => sum + Math.pow(f.gazeY - avgGazeY, 2), 0) / this.calibrationFrames.length
      );

      this.calibrationData = {
        baseYaw: avgYaw,
        basePitch: avgPitch,
        baseRoll: avgRoll,
        baseGazeX: avgGazeX,
        baseGazeY: avgGazeY,
        stdGazeX: stdGazeX,
        stdGazeY: stdGazeY
      };

      this.isCalibrated = true;
      this.statusElement.textContent = i18n.t('calibrationComplete');
    }
  }

  analyzeResults(results) {
    if (!results.faceBlendshapes || results.faceBlendshapes.length === 0 ||
        !results.faceLandmarks || results.faceLandmarks.length === 0) {
      const warnings = [i18n.t('faceNotDetected')];
      this.updateScore(0, warnings);
      this.handleUnfocus(0, warnings);
      return;
    }

    const blendshapes = results.faceBlendshapes[0].categories;
    const getBlendshape = (name) => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? shape.score : 0;
    };

    const eyeBlinkLeft = getBlendshape('eyeBlinkLeft');
    const eyeBlinkRight = getBlendshape('eyeBlinkRight');
    const jawOpen = getBlendshape('jawOpen');

    let headTurnAway = false;
    let eyeGazeAway = false;

    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      const matrix = results.facialTransformationMatrixes[0].data;
      const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
      const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8] * matrix[8] + matrix[10] * matrix[10])) * (180 / Math.PI);

      const yawDiff = Math.abs(yaw - this.calibrationData.baseYaw);
      const pitchDiff = Math.abs(pitch - this.calibrationData.basePitch);

      headTurnAway = yawDiff > 25 || pitchDiff > 20;
    }

    const landmarks = results.faceLandmarks[0];
    const gazeRatio = this.getGazeRatio(landmarks);
    eyeGazeAway = this.checkGazeAway(gazeRatio);

    const isEyesClosed = eyeBlinkLeft > 0.5 && eyeBlinkRight > 0.5;
    const isYawning = jawOpen > 0.4;

    let score = 100;
    const warnings = [];

    if (isEyesClosed) {
      score -= 40;
      warnings.push(i18n.t('eyesClosed'));
    }
    if (headTurnAway) {
      score -= 30;
      warnings.push(i18n.t('headAway'));
    }
    if (eyeGazeAway && !headTurnAway) {
      score -= 25;
      warnings.push(i18n.t('gazeAway'));
    }
    if (isYawning) {
      score -= 20;
      warnings.push(i18n.t('yawning'));
    }

    score = Math.max(0, Math.min(100, score));
    this.updateScore(score, warnings);
    this.handleUnfocus(score, warnings);
  }

  handleUnfocus(score, warnings) {
    if (this.currentMode === 'scoreonly') {
      this.unfocusOverlay.classList.add('hidden');
      return;
    }

    const faceNotDetected = warnings.includes(i18n.t('faceNotDetected'));
    const isYawning = warnings.includes(i18n.t('yawning'));
    const isGazeAway = warnings.includes(i18n.t('gazeAway'));

    if (this.currentMode === 'strict') {
      if (faceNotDetected) {
        this.unfocusOverlay.classList.remove('hidden');
        if (!this.learningVideo.paused) {
          this.learningVideo.pause();
        }
      } else {
        this.unfocusOverlay.classList.add('hidden');
        if (this.learningVideo.paused && this.learningVideo.src) {
          this.learningVideo.play();
        }
      }

      if ((isYawning || isGazeAway) && !this.volumeBoosted) {
        this.volumeBoosted = true;
        this.learningVideo.volume = Math.min(1.0, this.baseVolume + 0.3);
      } else if (!isYawning && !isGazeAway && this.volumeBoosted) {
        this.volumeBoosted = false;
        this.learningVideo.volume = this.baseVolume;
      }
      return;
    }

    if (score < this.UNFOCUS_THRESHOLD) {
      this.unfocusOverlay.classList.remove('hidden');
      if (!this.learningVideo.paused) {
        this.learningVideo.pause();
      }
    } else {
      this.unfocusOverlay.classList.add('hidden');
      if (this.learningVideo.paused && this.learningVideo.src && !this.debugMode) {
        this.learningVideo.play();
      }
    }
  }

  updateScore(score, warnings) {
    this.scoreElement.textContent = Math.round(score);

    this.scoreCircle.classList.remove('high', 'medium', 'low');
    if (score >= 70) {
      this.scoreCircle.classList.add('high');
    } else if (score >= 40) {
      this.scoreCircle.classList.add('medium');
    } else {
      this.scoreCircle.classList.add('low');
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

        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: '#C0C0C070', lineWidth: 1 }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: '#30FF30' }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: '#30FF30' }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
          { color: '#E0E0E0' }
        );
        this.drawingUtils.drawConnectors(
          scaledLandmarks,
          FaceLandmarker.FACE_LANDMARKS_LIPS,
          { color: '#FF3030' }
        );

        this.drawIris(scaledLandmarks, LEFT_IRIS_INDICES, '#00FFFF');
        this.drawIris(scaledLandmarks, RIGHT_IRIS_INDICES, '#00FFFF');
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

  toggleDebug() {
    this.debugMode = !this.debugMode;
    const videoContainer = document.getElementById('video-container');
    const sidePanel = document.getElementById('side-panel');

    if (this.debugMode) {
      this.learningVideo.classList.remove('active');
      this.videoPlaceholder.classList.add('hidden');
      this.cameraContainer.classList.remove('hidden');
      this.cameraContainer.classList.add('fullscreen');
      videoContainer.appendChild(this.cameraContainer);
    } else {
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
}

new FocusApp();
