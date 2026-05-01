export type MessageToContent =
  | { type: "TOGGLE_SELECTION_MODE" }
  | { type: "SHOW_ANSWER"; answer: string }
  | { type: "SHOW_ERROR"; message: string }
  | { type: "SHOW_STATUS"; message: string };

export type MessageToBackground =
  | { type: "ELEMENT_SELECTED"; html: string }
  | { type: "SELECTION_CANCELLED" }
  | { type: "CANCEL_REQUEST" };
