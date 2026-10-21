import { postJson, ServiceError } from '../lib/http.js';

export class SurveyBookingClient {
  constructor(connection, { fetchImpl = fetch } = {}) { Object.assign(this, { connection, fetchImpl }); }
  async call(body) {
    return postJson(this.connection.url, { body, timeoutMs: this.connection.timeoutMs,
      headers: { Authorization: `Bearer ${this.connection.token}` }, fetchImpl: this.fetchImpl,
      mapError: async response => {
        const data = await response.json().catch(() => ({}));
        const known = ['SURVEY_SLOT_TAKEN', 'SURVEY_PROPERTY_UNAVAILABLE', 'AUCTION_EXTERIOR_ONLY', 'INVALID_SURVEY_TIME', 'SURVEY_REQUEST_CONFLICT'];
        return new ServiceError(known.includes(data.error) ? data.error : 'SURVEY_UNAVAILABLE', response.status);
      } });
  }
  async availability(agentId, propertyId, date) {
    const r = await this.call({ action: 'availability', agent_id: agentId, property_id: propertyId, date });
    if (r.date !== date || !Array.isArray(r.blockedSlots) || r.blockedSlots.length > 24 || r.blockedSlots.some(s => !/^\d{2}:00$/.test(s.label) || typeof s.blocked !== 'boolean')) throw new ServiceError('INVALID_SURVEY_AVAILABILITY', 502);
    return r;
  }
  async book(body) {
    const r = await this.call({ action: 'book', ...body });
    if (!/^[1-9]\d*$/.test(r.booking_id) || r.agent_id !== body.agent_id || r.property_id !== body.property_id || r.date !== body.date || r.time !== body.time || !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(r.status)) throw new ServiceError('INVALID_SURVEY_RECEIPT', 502);
    return r;
  }
}
// The Playground can exercise the entire conversation, without real bookings.
export const previewSurveys = {
  async availability(_agent, _asset, date) { return { date, blockedSlots: [8,9,10,11,13,14,15,16,17].map(h => ({ label: `${String(h).padStart(2,'0')}:00`, blocked: false })) }; },
  async book(body) { return { booking_id: '1', agent_id: body.agent_id, property_id: body.property_id, date: body.date, time: body.time, status: 'PENDING', simulated: true }; },
};
