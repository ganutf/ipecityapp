export const PROFILE_TAGS = [
  'tech founder',
  'lawyer', 
  'designer',
  'researcher',
  'student',
  'scientist',
  'creator',
  'developer',
  'public servant',
  'technologist'
] as const;

export type ProfileTag = typeof PROFILE_TAGS[number];