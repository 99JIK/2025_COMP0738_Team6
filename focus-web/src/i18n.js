const translations = {
  en: {
    appName: 'FOCUS',
    videoList: 'Video List',
    noVideos: 'No videos available',
    watch: 'Watch',
    back: 'Back',
    start: 'Start',
    stop: 'Stop',
    loadVideo: 'Load Video',
    preparing: 'Preparing',
    ready: 'Ready',
    stopped: 'Stopped',
    videoLoaded: 'Video loaded',
    cameraAccessFailed: 'Camera access failed',
    lookAtCamera: 'Please look at the camera...',
    showFaceToCamera: 'Show your face to the camera...',
    calibrating: 'Calibrating...',
    calibrationComplete: 'Calibration complete!',
    focusing: 'Focusing',
    faceNotDetected: 'Face not detected',
    eyesClosed: 'Eyes closed',
    headAway: 'Head turned away',
    gazeAway: 'Gaze away',
    yawning: 'Yawning',
    fidgeting: 'Restless movement',
    browDown: 'Frowning (AU4)',
    smile: 'Smile (AU12)',
    mouthPucker: 'Mouth pucker (AU18)',
    mouthPress: 'Lip press (AU24)',
    eyeWide: 'Eye wide (AU5)',
    mouthFrown: 'Mouth frown (AU15)',
    browInnerUp: 'Brow inner up (AU1)',
    mouthFunnel: 'Mouth round (AU22)',
    focusPlease: 'Please focus!',
    videoPlaceholder: 'Select a video to watch',
    language: 'Language',
    untitled: 'Untitled',
    quiz: 'Quiz',
    backToList: 'Back to List',
    detectingFace: 'Detecting face...',
    faceDetected: 'Face detected!',
    playVideo: 'Play Video',
    selectMode: 'Select Mode',
    modeNormal: 'Normal',
    modeNonIntrusive: 'Non-Intrusive',
    modeIntrusive: 'Intrusive',
    modeNormalDesc: 'Standard video player with controls',
    modeNonIntrusiveDesc: 'Gentle popup when unfocused (your choice to pause)',
    modeIntrusiveDesc: 'Auto-pause on unfocus, volume control',
    // Non-intrusive popup
    popupTitle: 'Having trouble focusing?',
    popupPause: 'Take a break',
    popupContinue: 'No, I\'m fine',
    popupCooldownSetting: 'Popup interval',
    popupCooldownSeconds: 'sec',
    resumeVideo: 'Resume',
    subtitles: 'Subtitles',
    subtitleOff: 'Off',
    subtitleKorean: '한국어',
    heroDescription: 'Learn with face recognition-based focus monitoring',
    focusAcronym: '<span class="highlight">F</span>acial <span class="highlight">O</span>bservation & <span class="highlight">C</span>oncentration <span class="highlight">U</span>nderstanding <span class="highlight">S</span>ystem',
    attribution: 'Demo videos from',
    // Survey
    surveyTitle: 'Learning Experience Survey',
    surveyDescription: 'Please rate your learning experience',
    surveyPrevious: 'Previous',
    surveyNext: 'Next',
    surveyComplete: 'Complete',
    surveyFinish: 'Back to List',
    surveyCompleteTitle: 'Survey Completed',
    surveyCompleteMessage: 'Thank you for your feedback!',
    continueToSurvey: 'Take Survey'
  },
  ko: {
    appName: 'FOCUS',
    videoList: '영상 목록',
    noVideos: '영상이 없습니다',
    watch: '시청',
    back: '뒤로',
    start: '시작',
    stop: '정지',
    loadVideo: '영상 불러오기',
    preparing: '준비 중',
    ready: '준비 완료',
    stopped: '정지됨',
    videoLoaded: '영상 로드됨',
    cameraAccessFailed: '카메라 접근 실패',
    lookAtCamera: '카메라를 정면으로 바라봐주세요...',
    showFaceToCamera: '얼굴을 카메라에 보여주세요...',
    calibrating: '보정 중...',
    calibrationComplete: '보정 완료!',
    focusing: '집중 중',
    faceNotDetected: '얼굴 미감지',
    eyesClosed: '눈 감음',
    headAway: '머리 이탈',
    gazeAway: '시선 이탈',
    yawning: '하품',
    fidgeting: '과도한 움직임',
    browDown: '눈썹 찌푸림 (AU4)',
    smile: '미소 (AU12)',
    mouthPucker: '입 오므림 (AU18)',
    mouthPress: '입술 누름 (AU24)',
    eyeWide: '눈 넓게 뜸 (AU5)',
    mouthFrown: '입꼬리 내림 (AU15)',
    browInnerUp: '눈썹 올림 (AU1)',
    mouthFunnel: '입 동그랗게 (AU22)',
    focusPlease: '집중해주세요!',
    videoPlaceholder: '시청할 영상을 선택하세요',
    language: '언어',
    untitled: '제목 없음',
    quiz: '퀴즈',
    backToList: '목록으로',
    detectingFace: '얼굴 인식 중...',
    faceDetected: '얼굴 인식됨!',
    playVideo: '영상 시청',
    selectMode: '모드 선택',
    modeNormal: '일반',
    modeNonIntrusive: '비간섭',
    modeIntrusive: '간섭',
    modeNormalDesc: '일반적인 영상 플레이어',
    modeNonIntrusiveDesc: '집중 저하 시 부드러운 팝업 (선택적 일시정지)',
    modeIntrusiveDesc: '집중 안 하면 자동 일시정지, 볼륨 조절',
    // Non-intrusive popup
    popupTitle: '혹시 잠깐 집중에 어려움이 있었을까요?',
    popupPause: '잠시 멈추겠습니다',
    popupContinue: '아니요, 괜찮습니다',
    popupCooldownSetting: '팝업 간격',
    popupCooldownMinutes: '분',
    popupCooldownSeconds: '초',
    resumeVideo: '다시 시작',
    subtitles: '자막',
    subtitleOff: '끄기',
    subtitleKorean: '한국어',
    heroDescription: '얼굴 인식 기반 집중도 모니터링과 함께 학습하세요',
    focusAcronym: '<span class="highlight">F</span>acial <span class="highlight">O</span>bservation & <span class="highlight">C</span>oncentration <span class="highlight">U</span>nderstanding <span class="highlight">S</span>ystem',
    attribution: '데모 영상 출처:',
    // Survey
    surveyTitle: '학습 경험 설문',
    surveyDescription: '학습 경험을 평가해주세요',
    surveyPrevious: '이전',
    surveyNext: '다음',
    surveyComplete: '완료',
    surveyFinish: '목록으로 돌아가기',
    surveyCompleteTitle: '설문이 완료되었습니다',
    surveyCompleteMessage: '소중한 피드백 감사합니다!',
    continueToSurvey: '설문 참여하기'
  }
};

class I18n {
  constructor() {
    this.currentLang = localStorage.getItem('focus-lang') || 'ko';
  }

  t(key) {
    return translations[this.currentLang][key] || key;
  }

  setLang(lang) {
    this.currentLang = lang;
    localStorage.setItem('focus-lang', lang);
  }

  getLang() {
    return this.currentLang;
  }

  toggleLang() {
    const newLang = this.currentLang === 'ko' ? 'en' : 'ko';
    this.setLang(newLang);
    return newLang;
  }
}

export const i18n = new I18n();
