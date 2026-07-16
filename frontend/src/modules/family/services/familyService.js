import api from "../../../services/api";

export const getFamilyMembers = async () => {
  const res = await api.get("/family");
  return res.data;
};

export const addFamilyMember = async (data) => {
  const res = await api.post("/family", data);
  return res.data;
};

export const acceptInvitation = async (token) => {
  const res = await api.post(`/family/invitations/${token}/accept`);
  return res.data;
};

export const declineInvitation = async (token) => {
  const res = await api.post(`/family/invitations/${token}/decline`);
  return res.data;
};

export const deleteFamilyMember = async (relativeId) => {
  const res = await api.delete(`/family/members/${relativeId}`);
  return res.data;
};

export const revokeConsent = async (relativeId, reason) => {
  const res = await api.post(`/family/members/${relativeId}/revoke`, { reason });
  return res.data;
};
