export type OfficerSaveState = {
  pending: boolean;
  error?: string;
  retry?: () => void;
};

export type SaveStateReporter = (state: OfficerSaveState | null) => void;
