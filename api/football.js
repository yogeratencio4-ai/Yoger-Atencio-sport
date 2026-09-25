export default async function handler(request, response) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const apiResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await apiResponse.json();

    response.status(apiResponse.status).json(data);
  } catch (error) {
    response.status(500).json({
      error: "No se pudieron obtener los partidos"
    });
  }
}
