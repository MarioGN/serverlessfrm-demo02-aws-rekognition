'use strict';
const { get } = require("axios");

class Handler {
  constructor({ rekoSrv, translatorSrv }) {
    this.rekoSrv = rekoSrv;
    this.translatorSrv = translatorSrv;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSrv.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise();

    const workingItems = result.Labels
      .filter(({ Confidence }) => Confidence > 80);

    const names = workingItems
      .map(({ Name }) => Name)
      .join(" and ");

    return { names, workingItems };
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: "en",
      TargetLanguageCode: "pt",
      Text: text
    };

    const { TranslatedText } = await this.translatorSrv
                                        .translateText(params)
                                        .promise();

    return TranslatedText.split(" e ");
  }

  formateTextResults(texts, workingItems) {
    const finalText = [];
    console.log(texts, workingItems);

    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText];
      const confidence = workingItems[indexText].Confidence;

      finalText.push(
        ` ${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      );
    }

    return finalText.join("\n");
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: "arraybuffer"
    });

    const buffer = Buffer.from(response.data, "base64");
    
    return buffer;
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;

      console.log("Downloading image...");
      const buffer = await this.getImageBuffer(imageUrl);

      console.log("Detecting labels...");
      const {names, workingItems} = await this.detectImageLabels(buffer);

      console.log("Translate to Portuguese...");
      const texts = await this.translateText(names);
      console.log("TRT", texts);

      console.log("Handling final object");
      const finalText = this.formateTextResults(texts, workingItems);
      console.log("finishing...");

      return  {
        statusCode: 200,
        body: "A imagem tem\n ".concat(finalText)
      }
    } catch (error) {
      console.log("[ERROR]", error.stack);
      return {
        statusCode: 500,
        body: "Internal server error!"
      }
    }
  }
}

// factory
const aws = require("aws-sdk");
const reko = new aws.Rekognition();
const translator = new aws.Translate();

const handler = new Handler({
  rekoSrv: reko,
  translatorSrv: translator
});

module.exports.main = handler.main.bind(handler);
