export type OfficerSaveState = {
  dirty: boolean;
  saving: boolean;
  error?: string;
  save: () => Promise<void>;
};

export type SaveStateReporter = (state: OfficerSaveState | null) => void;
