import {Watsonx} from "./continue-watsonx/src/watsonx"; 

// Original:
//export function modifyConfig(config: Config): Config {
//  return config;
//}

export function modifyConfig(config: Config): Config {
  return Watsonx.modifyConfig(config);
}