export default async function handler(request, response) {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {
      return response.status(500).json({
        error: "Falta configurar API_FOOTBALL_KEY en Vercel"
      });
    }

    const headers = {
      "x-apisports-key": API_KEY
    };

    // Fecha actual
    const ahora = new Date();

    const hoy = ahora.toISOString().split("T")[0];

    const mananaFecha = new Date(ahora);
    mananaFecha.setUTCDate(mananaFecha.getUTCDate() + 1);
    const manana = mananaFecha.toISOString().split("T")[0];

    /*
     * ==========================================================
     * 1. PARTIDOS EN VIVO
     * ==========================================================
     *
     * live=all obtiene TODOS los partidos en vivo
     * de todas las ligas disponibles.
     */
    const liveResponse = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers
      }
    );

    const liveData = await liveResponse.json();

    if (!liveResponse.ok) {
      return response.status(liveResponse.status).json({
        error: "Error obteniendo partidos en vivo",
        detalles: liveData
      });
    }

    const enVivo = liveData.response || [];

    /*
     * ==========================================================
     * 2. PARTIDOS DE HOY Y MAÑANA
     * ==========================================================
     */
    const fixturesResponse = await fetch
