import { open, FetchStore, get, slice } from 'zarrita'

class AtlasService {
  private readonly store: FetchStore

  constructor(storeAddress: string) {
    this.store = new FetchStore(storeAddress)
  }

  async getChunk() {
    const array = await open(this.store, { kind: 'array' })
    console.log(array)
    console.log(array.shape)
    console.log(array.chunks)
    console.log(array.dtype)

    const region = await get(array, [slice(10, 20), slice(10, 20), null])
    console.log(region)
  }
}

export const atlasService = new AtlasService('http://localhost:8080/allen_mouse/10.0.zarr')
