/** Capability registry — a model may only advertise what is verified. */

export type CapabilityId =
  | 'text'
  | 'vision'
  | 'imageInput'
  | 'imageGen'
  | 'imageEdit'
  | 'fileUpload'
  | 'pdf'
  | 'audioIn'
  | 'audioOut'
  | 'videoIn'
  | 'tools'
  | 'webSearch'
  | 'structured'
  | 'reasoning';

export const CAPABILITIES: CapabilityId[] = [
  'text',
  'vision',
  'imageInput',
  'imageGen',
  'imageEdit',
  'fileUpload',
  'pdf',
  'audioIn',
  'audioOut',
  'videoIn',
  'tools',
  'webSearch',
  'structured',
  'reasoning',
];

/** Filter groups used on the Models page. */
export const CAP_FILTERS: Record<string, CapabilityId[]> = {
  vision: ['vision', 'imageInput'],
  files: ['fileUpload', 'pdf'],
  tools: ['tools'],
  reasoning: ['reasoning'],
  imageGen: ['imageGen', 'imageEdit'],
};

/** Grouping used in the model detail drawer. */
export const CAP_GROUP: { title: 'cap.text' | 'cap.imageGen'; ids: CapabilityId[] }[] = [
  { title: 'cap.text', ids: ['text', 'reasoning', 'structured', 'tools', 'webSearch'] },
  {
    title: 'cap.imageGen',
    ids: ['vision', 'imageInput', 'imageGen', 'imageEdit', 'fileUpload', 'pdf', 'audioIn', 'audioOut', 'videoIn'],
  },
];

export function capTKey(id: CapabilityId): `cap.${CapabilityId}` {
  return `cap.${id}`;
}
