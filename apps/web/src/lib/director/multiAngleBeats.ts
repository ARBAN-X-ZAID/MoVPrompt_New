// 6 canonical camera angles for the Multi-Angle workflow. Same subject, same
// scene, same wardrobe/lighting/props — only the camera position changes.
//
// The edge function prepends a strong "angle-only" lock to each beat so the
// model treats every panel as a re-angle of the reference, not a redesign.

export type SubjectKindForAngles = "character" | "product";

export const MULTI_ANGLE_LABELS = [
  "Front",
  "3/4 left",
  "Profile left",
  "Back / Reverse",
  "3/4 right",
  "Low hero",
] as const;

export function multiAngleBeats(subjectKind: SubjectKindForAngles): string[] {
  if (subjectKind === "product") {
    return [
      "Front-on angle, eye-level, dead-center composition. The same product fills the frame at the same scale as the reference, with the same lighting and background.",
      "Three-quarter angle from the left, eye-level. Reveals the left face and the front of the product together. Same scene, same scale, same lighting.",
      "Pure left profile, eye-level, the product's left side facing the camera. Same scene, same scale, same lighting as the reference.",
      "Back / reverse angle, eye-level. Shows the back of the product cleanly. Same scene, same scale, same lighting as the reference.",
      "Three-quarter angle from the right, eye-level. Reveals the right face and the front of the product together. Same scene, same scale, same lighting.",
      "Low hero angle from front-below looking up, slight tilt. Makes the product feel monumental. Same scene, same scale, same lighting as the reference.",
    ];
  }
  return [
    "Front-on angle, eye-level, the character facing camera. Same wardrobe, same hair, same expression, same scene as the reference.",
    "Three-quarter angle from the left at eye-level, the character's body turned about 45° away. Same wardrobe, same scene, same lighting.",
    "Pure left profile, eye-level, the character looking off-camera left. Same wardrobe, same scene, same lighting as the reference.",
    "Back / reverse angle, eye-level, looking at the back of the character. Same wardrobe, same hair, same scene, same lighting as the reference.",
    "Three-quarter angle from the right at eye-level, the character's body turned about 45° the other way. Same wardrobe, same scene, same lighting.",
    "Low hero angle from front-below looking up at the character, slight tilt. Makes them feel heroic. Same wardrobe, same scene, same lighting.",
  ];
}
