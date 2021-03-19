/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import * as tendermintNdid from '../tendermint/ndid';

export async function getServicePriceCeiling({ serviceId }) {
  const servicePriceCeiling = await tendermintNdid.getServicePriceCeiling(
    serviceId
  );

  if (servicePriceCeiling == null) {
    return null;
  } else {
    return {
      service_id: serviceId,
      price_ceiling_by_currency_list:
        servicePriceCeiling.price_ceiling_by_currency_list,
    };
  }
}

export async function getServicePriceMinEffectiveDatetimeDelay() {
  return await tendermintNdid.getServicePriceMinEffectiveDatetimeDelay();
}

export async function getServicePriceList({ nodeId, serviceId }) {
  const servicePriceList = await tendermintNdid.getServicePriceList({
    node_id: nodeId,
    service_id: serviceId,
  });

  if (servicePriceList == null) {
    return null;
  } else {
    const priceList = servicePriceList.price_list.map((price) => {
      const {
        creation_block_height,
        creation_chain_id,
        ...filteredServicePriceList
      } = price;

      return {
        ...filteredServicePriceList,
        creation_block_height: `${creation_chain_id}:${creation_block_height}`,
      };
    });

    return {
      node_id: nodeId,
      price_list: priceList,
    };
  }
}
