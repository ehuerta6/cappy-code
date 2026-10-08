export type OfficerSaveState = {
  dirty: boolean;
  saving: boolean;
  error?: string;
  save: () => Promise<boolean>;
};

export type SaveStateReporter = (state: OfficerSaveState | null) => void;
