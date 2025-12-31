import { MockedCryptoService, testValidation } from "@for-it/domain-lib/mocks";
import type { EntityManager } from "typeorm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { LocalityEntity } from "../../entities/locality.js";
import { mockLocality } from "../../entities/mocks/locality.js";
import { mockMunicipality } from "../../entities/mocks/mock-municipality.js";
import { mockProvinces } from "../../entities/mocks/mock-province.js";
import { MunicipalityEntity } from "../../entities/municipality.js";
import { ProvinceEntity } from "../../entities/province.js";
import { createDBMock } from "../../services/mocks/create-db-mock.js";
import { getLocality } from "./get-locality.js";

describe("getLocality", async () => {
  const cryptoService = new MockedCryptoService();

  const municipalityId = await cryptoService.generateUUID();
  const municipalityId2 = await cryptoService.generateUUID();
  const provinceId = await cryptoService.generateUUID();
  let db: EntityManager;

  beforeAll(async () => {
    db = await createDBMock();
    await db.save(ProvinceEntity, [
      await mockProvinces(cryptoService, {
        id: provinceId,
        name: "provincia A",
      }),
    ]);
    await db.save(MunicipalityEntity, [
      await mockMunicipality(cryptoService, {
        id: municipalityId,
        name: "municipalidad A",
        provinceId,
      }),
      await mockMunicipality(cryptoService, {
        id: municipalityId2,
        name: "municipalidad B",
        provinceId,
      }),
    ]);
    await db.save(LocalityEntity, [
      await mockLocality(cryptoService, {
        name: "localidad A",
        municipalityId: municipalityId,
      }),
      await mockLocality(cryptoService, {
        name: "localidad B",
        municipalityId: municipalityId,
      }),
      await mockLocality(cryptoService, {
        name: "localidad C",
        municipalityId: municipalityId2,
      }),
    ]);
  });
  afterAll(async () => {
    await db.connection.dropDatabase();
    await db.connection.destroy();
  });

  test("Given a municipalityId, Should return localities with their municipalities", async () => {
    const result = await getLocality.useCase(
      {
        db,
      },
      {
        municipalityId: municipalityId,
      }
    );

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("localidad A");
  });
  test("Should return all localities with their municipalities", async () => {
    const result = await getLocality.useCase(
      {
        db,
      },
      {}
    );

    expect(result).toHaveLength(3);
    expect(result[1].name).toBe("localidad B");
  });
  test("PayloadValidation", async () => {
    await testValidation({
      useCase: getLocality,
      dependencies: {
        db,
      },
      invalidPayloads: [
        { municipalityId: 1234 },
        { municipalityId: "hello world" },
      ],
      validPayloads: [
        { municipalityId: municipalityId },
        { municipalityId: await cryptoService.generateUUID() },
      ],
    });
  });
});
