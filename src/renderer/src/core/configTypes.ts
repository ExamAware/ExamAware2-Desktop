export interface ExamInfo {
  name: string
  start: string
  end: string
  alertTime: number // 考试结束前几分钟提醒
}

/**
 * Represents the configuration for an exam.
 */
export interface ExamConfig {
  /**
   * The name of the exam.
   */
  examName: string

  /**
   * A message related to the exam.
   */
  message: string

  /**
   * The room where the exam will take place.
   */
  room: string

  /**
   * An array of information related to the exam.
   */
  examInfos: ExamInfo[]
}
