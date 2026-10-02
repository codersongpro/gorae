// 참고 전용 작품: 학생고래 모드에서는 보고 실행만 하고, 담기·리믹스·꾸러미·레시피·공유는 막는다 (DOM 없음)
export const isReferenceOnly = (work) => !!(work && work.referenceOnly === true);
export const isRestricted = (work, mode) => isReferenceOnly(work) && mode !== 'mother';
