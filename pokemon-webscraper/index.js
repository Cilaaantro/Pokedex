async function fetchPokemonData(pokemonId){
  try{
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}/`);

    if(!response.ok){
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if(!data.name)
      throw new Error(`Pokemon's (id:${pokemonId}) name doesn't exist`);

    console.log(data.name)

    return data;

  }catch(error){
    console.error(`pokemon of id ${pokemonId} could not be fully found`,error);
  }

}

async function storeAllPokemon(){
  for(let i = 1; i<=1025; i++)
    await fetchPokemonData(i);
}

storeAllPokemon()

//fetchPokemonData(1);
