import { FamilyGraph, PersonId } from "@/shared/types/domain";

// helper to brand string as PersonId (mock-only)
const pid = (id: string) => id as PersonId;

export const mockFamilyTree: FamilyGraph = {
  people: {
    [pid("p1")]: {
      id: pid("p1"),
      firstName: "Ramesh",
      lastName: "Thapa",
      birthDate: "1965-04-12",
    },
    [pid("p2")]: {
      id: pid("p2"),
      firstName: "Sita",
      lastName: "Thapa",
      birthDate: "1968-09-30",
    },
    [pid("p3")]: {
      id: pid("p3"),
      firstName: "Amrit",
      lastName: "Thapa",
      birthDate: "1996-06-30",
    },
    [pid("p4")]: {
      id: pid("p4"),
      firstName: "Anita",
      lastName: "Thapa",
      birthDate: "1999-02-18",
    },
  },

  relationships: [
    // spouses
    {
      from: pid("p1"),
      to: pid("p2"),
      type: "spouse",
    },
    {
      from: pid("p2"),
      to: pid("p1"),
      type: "spouse",
    },

    // parents
    {
      from: pid("p1"),
      to: pid("p3"),
      type: "parent",
    },
    {
      from: pid("p2"),
      to: pid("p3"),
      type: "parent",
    },
    {
      from: pid("p1"),
      to: pid("p4"),
      type: "parent",
    },
    {
      from: pid("p2"),
      to: pid("p4"),
      type: "parent",
    },
  ],
};
