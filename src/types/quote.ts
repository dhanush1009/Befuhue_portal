export interface Quote {
  id:     string;
  text:   string;
  author: string | null;
}

export interface AdminQuote extends Quote {
  isSystem:  boolean;
  isActive:  boolean;
  addedBy:   { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  text:    string;
  author?: string;
}

export interface UpdateQuoteInput {
  text?:     string;
  author?:   string;
  isActive?: boolean;
}
