// YOUTUBE URL
export async function GetDirectLink(url: string) {
    const API_URL = process.env.EXPO_PUBLIC_API_URL 
    return `${API_URL}/api/download?url=${encodeURIComponent(url)}`;
}