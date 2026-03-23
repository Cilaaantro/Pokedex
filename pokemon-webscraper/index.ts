import sharp from 'sharp';
import fs from 'fs/promises'
import path from 'path';
const ffmpeg = require('fluent-ffmpeg');
import { Readable } from 'stream';

const numOfPokemons = 1025;

async function fetchPokemonData(pokemonId: number){
  try{
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}/`);

    if(!response.ok){
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const pokemonJson = await response.json();

    // if(!pokemonJson.name)
    //   throw new Error(`Pokemon's (id:${pokemonId}) name doesn't exist`);

    //console.log(pokemonJson.name);

    return pokemonJson;

  }catch(error){
    console.error(`pokemon of id ${pokemonId} could not be fully found`, error);
  }

}

async function getImageBuffer(pokemonImageURL: string){
  try{
    const response = await fetch(pokemonImageURL);
    
    if (!response.ok) 
      throw new Error(`Failed to fetch: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();

    // convert it to a Node.js Buffer
    const imageBuffer = Buffer.from(arrayBuffer);

    return imageBuffer;

  }catch (error) {
    console.error('Image could not be fetched', error);
  }

}

async function getAudioBuffer(pokemonCryAudioURL: string){
  try{
    const response = await fetch(pokemonCryAudioURL);

    if(!response.ok)
      throw new Error(`Failed to fetch ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();

    // convert it to a Node.js Buffer
    const audioBuffer = Buffer.from(arrayBuffer);

    return audioBuffer;
  }catch(error){
    console.error('Audio could not be fetched', error);
  }

}

async function storePNGFile(pokemonSpritePosition: string, pokemonImageBuffer: Buffer, folderPath: string){
  const filePath = path.join(folderPath, `${pokemonSpritePosition}.png`);
  await fs.writeFile(filePath, pokemonImageBuffer);
}

async function storeWebPFile(pokemonSpritePosition: string, pokemonImageBuffer: Buffer, folderPath: string){
  const filePath = path.join(folderPath, `${pokemonSpritePosition}.webp`);
  try{
    await sharp(pokemonImageBuffer)
      .trim() 
      .webp({ 
        quality: 80,    // sweet spot for quality and size
        effort: 6,      // tells cpu to work harder for smaller size
        lossless: true // removes data that humans can't notice if false
      })
      .toFile(filePath);
  }catch(error){
    console.error('something occured that is preventing from converting to webp', error);
  }
}

async function storeUncompressedAudioFile(cryType: string, pokemonAudioBuffer: Buffer, folderPath: string){
  const filePath = path.join(folderPath, `${cryType}.ogg`);
  await fs.writeFile(filePath, pokemonAudioBuffer);
}

async function storeCompressedAudioFile(cryType: string, pokemonAudioBuffer: Buffer, folderPath: string){
  try{
    const filePath = path.join(folderPath, `${cryType}.ogg`);

    // turns into a stream that ffmpeg can read
    const bufferStream = new Readable();
    bufferStream.push(pokemonAudioBuffer);
    bufferStream.push(null);

    return new Promise<void>((resolve, reject) => {
      (ffmpeg as any)(bufferStream)
        .audioCodec('libvorbis') // Standard OGG codec
        .audioChannels(1)        // MONO: Cuts file size in half (you only have one speaker!)
        .audioBitrate('48k')     // Low bitrate: Perfect for tiny 3W speakers
        .on('error', (error: any) => reject(error))
        .on('end', () => resolve())
        .save(filePath);
    });
  }catch(error){
    console.error('something occured that is preventing from compressing the audio', error);
  }

 }

async function storeAllPokemon(storeImageFile = storePNGFile, storeAudioFile = storeUncompressedAudioFile, folderName = 'pokemon'){
  try{
    for(let id = 1; id<=numOfPokemons; id++){
      const pokemonJson = await fetchPokemonData(id);
      const sprites = pokemonJson.sprites

      const folderPath = path.join(__dirname, folderName, id.toString());
      await fs.rm(folderPath, { recursive: true, force: true });
      await fs.mkdir(folderPath, {recursive: true});

      for(const [spritePosition, spriteURL] of Object.entries(sprites)){
        if(typeof spriteURL !== 'string')
          continue;

        const pokemonImageBuffer = await getImageBuffer(spriteURL)

        if(!pokemonImageBuffer)
          throw new Error(`Failed to store the image for Pokemon (ID:${id})`);

        const spritesFolderPath = path.join(folderPath, 'sprites');
        await fs.mkdir(spritesFolderPath, {recursive: true});

        await storeImageFile(spritePosition, pokemonImageBuffer, spritesFolderPath);
      }
      
      const pokemonAudioBufferLegacy= pokemonJson.cries.legacy ? await getAudioBuffer(pokemonJson.cries.legacy):null;
      const pokemonAudioBufferLatest= pokemonJson.cries.latest ? await getAudioBuffer(pokemonJson.cries.latest):null;

      if(!(pokemonAudioBufferLegacy||pokemonAudioBufferLatest))
        throw new Error(`Failed to store the audio for Pokemon (ID:${id})`);

      const cryFolderPath = path.join(folderPath, 'cry');
      await fs.mkdir(cryFolderPath, {recursive: true});

      if(pokemonAudioBufferLegacy)
        await storeAudioFile('legacy', pokemonAudioBufferLegacy, cryFolderPath);
      if(pokemonAudioBufferLatest){
        if(id===923){ // ffmpeg doesn't work on id 923
          await storeUncompressedAudioFile('latest', pokemonAudioBufferLatest, cryFolderPath)
          console.log('923 reached and audio did not compress');
        }else
          await storeAudioFile('latest', pokemonAudioBufferLatest, cryFolderPath);
      }

      const jsonFilePath = path.join(folderPath, 'data.json');
      const jsonString = JSON.stringify(pokemonJson, null, 2);
      await fs.writeFile(jsonFilePath, jsonString, 'utf-8');

      console.log(`pokemon succesfully stored (ID: ${id})`);

    }

  }catch(error){
    console.log('there was an error storing the pokemons', error)
  }
}

//fetchPokemonData(1);
async function run() {
  // console.log("Starting uncompressed scrape...");
  // await storeAllPokemon();
  
  console.log("Starting compressed scrape...");
  await storeAllPokemon(storeWebPFile, storeCompressedAudioFile, 'pokemon_compressed');
}

run();
