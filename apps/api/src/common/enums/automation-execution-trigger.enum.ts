/** How an automation execution was started. */
export enum AutomationExecutionTrigger {
  SCHEDULE = 'schedule',
  EVENT = 'event',
  MANUAL = 'manual',
  APPROVAL = 'approval',
}
