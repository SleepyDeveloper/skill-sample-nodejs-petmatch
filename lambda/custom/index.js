/* eslint-disable  func-names */
/* eslint-disable  no-restricted-syntax */
/* eslint-disable  no-loop-func */
/* eslint-disable  consistent-return */
/* eslint-disable  no-console */
/* eslint-disable max-len */
/* eslint-disable prefer-destructuring */

const Alexa = require('ask-sdk-core');
const https = require('https');

/* INTENT HANDLERS */

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Welcome to pet match. I can help you find the best dog for you. ' +
        'What are two things you are looking for in a dog?')
      .reprompt('What size and temperament are you looking for in a dog?')
      .getResponse();
  },
};

const MythicalCreaturesHandler = {
  canHandle(handlerInput) {
    if (handlerInput.requestEnvelope.request.type !== 'IntentRequest'
      || handlerInput.requestEnvelope.request.intent.name !== 'PetMatchIntent') {
      return false;
    }

    let isMythicalCreatures = false;
    if (handlerInput.requestEnvelope.request.intent.slots.pet
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0]
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0]
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0].value
      && handlerInput.requestEnvelope.request.intent.slots.pet.resolutions.resolutionsPerAuthority[0].values[0].value.name === 'mythical_creatures') {
      const attributesManager = handlerInput.attributesManager;
      const sessionAttributes = attributesManager.getSessionAttributes();
      sessionAttributes.mythicalCreature = handlerInput.requestEnvelope.request.intent.slots.pet.value;
      attributesManager.setSessionAttributes(sessionAttributes);
      isMythicalCreatures = true;
    }

    return isMythicalCreatures;
  },
  handle(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    const outputSpeech = randomPhrase(slotsMeta.pet.invalid_responses).replace('{0}', sessionAttributes.mythicalCreature);

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  },
};

const InProgressPetMatchIntent = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    return request.type === 'IntentRequest'
      && request.intent.name === 'PetMatchIntent'
      && request.dialogState !== 'COMPLETED';
  },
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();

    if(sessionAttributes[currentIntent.name]) {
      const tempSlots = sessionAttributes[currentIntent.name].slots;
      for(key in tempSlots) {
        if (tempSlots[key].value && !currentIntent.slots[key].value) {
          currentIntent.slots[key] = tempSlots[key];
        }
      }
    }
    sessionAttributes[currentIntent.name] = currentIntent;
    attributesManager.setSessionAttributes(sessionAttributes);

    let prompt = '';

    for (const slotName in currentIntent.slots) {
      if (Object.prototype.hasOwnProperty.call(currentIntent.slots, slotName)) {
        const currentSlot = currentIntent.slots[slotName];
        if (currentSlot.confirmationStatus !== 'CONFIRMED'
          && currentSlot.resolutions
          && currentSlot.resolutions.resolutionsPerAuthority[0]) {
          if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_MATCH') {
            if (currentSlot.resolutions.resolutionsPerAuthority[0].values.length > 1) {
              prompt = 'Which would you like';
              const size = currentSlot.resolutions.resolutionsPerAuthority[0].values.length;

              currentSlot.resolutions.resolutionsPerAuthority[0].values
                .forEach((element, index) => {
                  prompt += ` ${(index === size - 1) ? ' or' : ' '} ${element.value.name}`;
                });

              prompt += '?';

              return handlerInput.responseBuilder
                .speak(prompt)
                .reprompt(prompt)
                .addElicitSlotDirective(currentSlot.name)
                .getResponse();
            }
          } else if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_NO_MATCH') {
            if (requiredSlots.indexOf(currentSlot.name) > -1) {
              prompt = `What ${currentSlot.name} are you looking for`;

              return handlerInput.responseBuilder
                .speak(prompt)
                .reprompt(prompt)
                .addElicitSlotDirective(currentSlot.name)
                .getResponse();
            }
          }
        }
      }
    }

    return handlerInput.responseBuilder
      .addDelegateDirective(currentIntent)
      .getResponse();
  },
};

const CompletedPetMatchIntent = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    return request.type === 'IntentRequest'
      && request.intent.name === 'PetMatchIntent'
      && request.dialogState === 'COMPLETED';
  },
  async handle(handlerInput) {
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;

    const slotValues = getSlotValues(filledSlots);
    const petMatchOptions = buildPetMatchOptions(slotValues);

    let outputSpeech = '';

    try {
      const response = await httpGet(petMatchOptions);

      if (response.result.length > 0) {
        outputSpeech = `So a ${slotValues.size.resolved} 
          ${slotValues.temperament.resolved} 
          ${slotValues.energy.resolved} 
          energy dog sounds good for you. Consider a 
          ${response.result[0].breed}`;
      } else {
        outputSpeech = `I am sorry I could not find a match 
          for a ${slotValues.size.resolved} 
          ${slotValues.temperament.resolved} 
          ${slotValues.energy.resolved} dog`;
      }
    } catch (error) {
      outputSpeech = 'I am really sorry. I am unable to access part of my memory. Please try again later';
      console.log(`Intent: ${handlerInput.requestEnvelope.request.intent.name}: message: ${error.message}`);
    }

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  },
};

const StartedInProgressFindAnimalShelterHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'FindAnimalShelterIntent'
      && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDelegateDirective()
      .getResponse();
  }
};

const HasZipFindAnimalShelterHandler = {
  canHandle(handlerInput) {
  
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'FindAnimalShelterIntent'
      && handlerInput.requestEnvelope.dialogState !== 'COMPLETED'
      && handlerInput.requestEnvelope.request.intent.slots.zip.value;
  },
  handle(handlerInput) {
    const zip = handlerInput.requestEnvelope.request.intent.slots.zip.value;
    let outputSpeech = 'Here is where you\'ll make your api call with ' + zip;
    // make the api call

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();
  }
};

const HasCityStateFindAnimalShelterHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'FindAnimalShelterIntent'
      && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED'
      && handlerInput.requestEnvelope.request.intent.slots.city.value
      && handlerInput.requestEnvelope.request.intent.slots.state.value;
  },
  handle(handlerInput) {
    const city = handlerInput.requestEnvelope.request.intent.slots.city.value;
    const state = handlerInput.requestEnvelope.request.intent.slots.state.value;
    let outputSpeech = 'Here is where you\'ll make your api call with ' + city + ', ' + state;
    // make the api call

    return handlerInput.responseBuilder
      .speak(outputSpeech)
      .getResponse();

  }
};

const ExplainSizeIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'ExplainSizeIntent';
  },
  handle(handlerInput) {

    const size = handlerInput.requestEnvelope.request.intent.slots.size.value;
    let unitOfMeasurement = handlerInput.requestEnvelope.request.intent.slots.unitOfMeasurement.value;

    if (!unitOfMeasurement) {
      unitOfMeasurement = 'pounds';
    }

    let outputSpeech = 'A ' + size + ' dog is ' 
      + sizeChart[size][unitOfMeasurement] + ' ' + unitOfMeasurement + '. ';

    const prompt = 'There are dogs that are tiny, small medium and large' 
      + ' which would you like?';

    return handlerInput.responseBuilder
      .speak(outputSpeech + prompt)
      .reprompt(prompt)
      .getResponse();
  }
};

const FallbackHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('I\'m sorry Pet Match can\'t help you with that. ' +
        'I can help find the perfect dog for you. What are two things you\'re ' +
        'looking for in a dog?')
      .reprompt('What size and temperament are you looking for?')
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('This is pet match. I can help you find the perfect pet for you. You can say, I want a dog.')
      .reprompt('What size and temperament are you looking for in a dog?')
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Bye')
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${handlerInput.requestEnvelope.request.type} ${handlerInput.requestEnvelope.request.type === 'IntentRequest' ? `intent: ${handlerInput.requestEnvelope.request.intent.name} ` : ''}${error.message}.`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};


/* CONSTANTS */

const petMatchApi = {
  hostname: 'e4v7rdwl7l.execute-api.us-east-1.amazonaws.com',
  pets: '/Test',
};

const requiredSlots = [
  'energy',
  'size',
  'temperament',
];

const slotsMeta = {
  pet: {
    invalid_responses: [
      "I'm sorry, but I'm not qualified to match you with {0}s.",
      'Ah yes, {0}s are splendid creatures, but unfortunately owning one as a pet is outlawed.',
      "I'm sorry I can't match you with {0}s.",
    ],
    error_default: "I'm sorry I can't match you with {0}s.",
  },
};

const sizeChart = {
  "tiny": {
    "pounds": "4 to 6",
    "kilograms": "1.8 to 2.7"
  },
  "small": {
    "pounds": "7 to 20",
    "kilograms": "3.8 to 9"
  },
  "medium": {
    "pounds": "21 to 54",
    "kilograms": "9.53 to 24.49"
  },
  "large": {
    "pounds": "55 to 80",
    "kilograms": "24.94 to 38.28"
  }
};

/* HELPER FUNCTIONS */

function buildPastMatchObject(response, slotValues) {
  return {
    match: response.result,
    pet: slotValues.pet.resolved,
    energy: slotValues.energy.resolved,
    size: slotValues.size.resolved,
    temperament: slotValues.temperament.resolved,
  };
}

function saveValue(options, handlerInput) {
  const key = `_${options.fieldName}`;
  const attributes = handlerInput.attributesManager.getSessionAttributes();

  if (options.append && attributes[key]) {
    attributes[key].push(options.data);
  } else if (options.append) {
    attributes[key] = [options.data];
  } else {
    attributes[key] = options.data;
  }
}

function getSlotValues(filledSlots) {
  const slotValues = {};

  console.log(`The filled slots: ${JSON.stringify(filledSlots)}`);
  Object.keys(filledSlots).forEach((item) => {
    const name = filledSlots[item].name;

    if (filledSlots[item] &&
      filledSlots[item].resolutions &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
      switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
        case 'ER_SUCCESS_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
            isValidated: true,
          };
          break;
        case 'ER_SUCCESS_NO_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].value,
            isValidated: false,
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false,
      };
    }
  }, this);

  return slotValues;
}

function randomPhrase(array) {
  return (array[Math.floor(Math.random() * array.length)]);
}


function buildPetMatchParams(slotValues) {
  return [
    ['SSET',
      `canine-${slotValues.energy.resolved}-${slotValues.size.resolved}-${slotValues.temperament.resolved}`],
  ];
}

function buildQueryString(params) {
  let paramList = '';
  params.forEach((paramGroup, index) => {
    paramList += `${index === 0 ? '?' : '&'}${encodeURIComponent(paramGroup[0])}=${encodeURIComponent(paramGroup[1])}`;
  });
  return paramList;
}

function buildHttpGetOptions(host, path, port, params) {
  return {
    hostname: host,
    path: path + buildQueryString(params),
    port,
    method: 'GET',
  };
}

function buildPetMatchOptions(slotValues) {
  const params = buildPetMatchParams(slotValues);
  const port = 443;
  return buildHttpGetOptions(petMatchApi.hostname, petMatchApi.pets, port, params);
}


function httpGet(options) {
  return new Promise(((resolve, reject) => {
    const request = https.request(options, (response) => {
      response.setEncoding('utf8');
      let returnData = '';

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`${response.statusCode}: ${response.req.getHeader('host')} ${response.req.path}`));
      }

      response.on('data', (chunk) => {
        returnData += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(returnData));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    request.end();
  }));
}


const skillBuilder = Alexa.SkillBuilders.custom();

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    MythicalCreaturesHandler,
    InProgressPetMatchIntent,
    CompletedPetMatchIntent,
    HasZipFindAnimalShelterHandler,
    HasCityStateFindAnimalShelterHandler,
    StartedInProgressFindAnimalShelterHandler,
    ExplainSizeIntentHandler,
    HelpHandler,
    FallbackHandler,
    ExitHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
