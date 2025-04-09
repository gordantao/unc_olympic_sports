import { authenticate } from "./authenticate";
import { saveJsonToCsv } from "./csv";

const endpoint: string =
  "https://prd-use-api-extforcedecks.valdperformance.com/v2019q3/teams/";
const team_id: string = "5b4690e7-25c4-4b79-927f-aec642e3c53e";
const EXPORT_DATA: boolean = true;

type Team = {
  attributeValueId: string;
  valueName: string;
  attributeTypeId: string;
  typeName: string;
};

type AthleteTeam = {
  teamId: string;
  id: string;
  hubId: string;
  name: string;
  givenName: string;
  familyName: string;
  lastModifiedUTC: string;
  notes: string;
  attributes: Array<Team>;
  links: {
    Tests: string;
  };
};

function normalizeAthleteTeamData(athletes: Array<AthleteTeam>) {
  let result: Array<object> = [];
  let athleteTeam: AthleteTeam;
  let teams: Array<Team>;
  let team: Team;
  for (let i = 0; i < athletes.length; i++) {
    athleteTeam = athletes[i];
    if (athleteTeam.attributes == null) continue;
    teams = athleteTeam.attributes;
    for (let j = 0; j < teams.length; j++) {
      team = teams[j];
      result.push({
        profileId: athleteTeam.id,
        modifiedDate: athleteTeam.lastModifiedUTC,
        teamId: team.attributeValueId,
        teamName: team.valueName,
        //orgId: team.attributeTypeId,
        //orgName: team.typeName,
      });
    }
  }
  return result;
}

async function get_data() {
  const response = await fetch(
    endpoint + `${team_id}/athletes`,
    {
      method: "GET",
      headers: {
        Authorization: await authenticate(),
      },
    },
  );
  return response.json();
}

if (EXPORT_DATA) {
  get_data().then((data) => {
    saveJsonToCsv(normalizeAthleteTeamData(data), "teams.csv");
  });
} else {
  get_data().then((data) => {
    console.log(normalizeAthleteTeamData(data));
  });
}
