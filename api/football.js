export default async function handler(request, response) {
  try {
    const ahora = new Date();

    const hoy = ahora.toISOString().split("T")[0];

    const mananaFecha = new Date(
      ahora.getTime() + 24 * 60 * 60 * 1000
    );

    const manana = mananaFecha.toISOString().split("T")[0];

    const apiResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?from=${hoy}&to=${manana}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json(data);
    }

    const partidos = data.response || [];

    const estadosEnVivo = [
      "1H",
      "2H",
      "HT",
      "ET",
      "BT",
      "P",
      "SUSP",
      "INT",
      "LIVE"
    ];

    const estadosFinalizados = [
      "FT",
      "AET",
      "PEN"
    ];

    const enVivo = partidos.filter((partido) =>
      estadosEnVivo.includes(partido.fixture.status.short)
    );

    const resultados = partidos.filter((partido) =>
      estadosFinalizados.includes(partido.fixture.status.short)
    );

    const proximos = partidos.filter((partido) => {

      const estado = partido.fixture.status.short;

      if (estado !== "NS") {
        return false;
      }

      const inicio = new Date(partido.fixture.date);

      return (
        inicio >= ahora &&
        inicio <= mananaFecha
      );

    });

    proximos.sort((a, b) =>
      new Date(a.fixture.date) -
      new Date(b.fixture.date)
    );

    resultados.sort((a, b) =>
      new Date(b.fixture.date) -
      new Date(a.fixture.date)
    );

    return response.status(200).json({
      enVivo,
      resultados,
      proximos,
      actualizado: new Date().toISOString()
    });

  } catch (error) {

    console.error(error);

    return response.status(500).json({
      error: "No se pudieron obtener los partidos"
    });
  }
}
