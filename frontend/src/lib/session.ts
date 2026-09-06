let accessToken: string | null = null;
let currentWorkspaceId: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setCurrentWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
}

export function getCurrentWorkspaceId() {
  return currentWorkspaceId;
}
