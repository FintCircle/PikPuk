export interface DbPhoto {
  id: string;
  caption: string;
  location: string;
  year: string;
  photographer?: string;
  story: string;
  image_url: string;
  r2_key?: string;
  sort_order: number;
  is_published: boolean;
  status: "pending" | "approved" | "rejected";
  submitted_by?: string;
  approved_by?: string;
  rejection_reason?: string;
  title?: string;
  source_info?: string;
  relationship_to_photo?: string;
  source_link?: string;
  permission_confirmed?: boolean;
  credit_name?: string;
  contact_email?: string;
  view_count: number;
  image_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface DbUserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  bio?: string;
  is_admin: boolean;
  is_banned: boolean;
  joined_at: string;
}

export interface DbPhotoView {
  id: string;
  photo_id: string;
  user_id: string;
  viewed_at: string;
}

export interface DbAppSetting {
  key: string;
  value: string | null;
  updated_at: string;
}
