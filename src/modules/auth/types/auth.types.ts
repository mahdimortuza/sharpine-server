export interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
}
