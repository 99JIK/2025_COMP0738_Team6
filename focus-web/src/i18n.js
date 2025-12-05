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
    modeNoControl: 'No Control',
    modeScoreOnly: 'Score Only',
    modeStrict: 'Strict',
    modeNormalDesc: 'Standard video player with controls',
    modeNoControlDesc: 'Cannot pause or control playback',
    modeScoreOnlyDesc: 'Only displays focus score',
    modeStrictDesc: 'Auto-pause on unfocus, volume control'
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
    modeNoControl: '조작 불가',
    modeScoreOnly: '점수만',
    modeStrict: '엄격',
    modeNormalDesc: '일반적인 영상 플레이어',
    modeNoControlDesc: '재생/일시정지 조작 불가',
    modeScoreOnlyDesc: '집중 점수만 표시',
    modeStrictDesc: '집중 안 하면 일시정지, 볼륨 조절'
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
