<script lang="ts" setup>
/**
 * @file Atlas picker interface.
 *
 * Handles connecting to an atlas source, picking an atlas, and managing favorites.
 */

import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { api } from "@/boot/axios.boot";

/**
 * Atlas source connection status.
 */
enum ConnectionStatus {
  Disconnected,
  Connecting,
  Connected
}

/**
 * Atlas item in response structure.
 */
interface AtlasItem {
  name: string;
  type: string;
}

/**
 * Atlas source connection response.
 */
interface AtlasSourceResponse {
  files: AtlasItem[];
}

const $q = useQuasar();

// Atlas source connection state.
const atlasSource = ref<string | null>("http://localhost:3000");
const connectionStatus = ref<ConnectionStatus>(ConnectionStatus.Disconnected);

// Atlas selection state.
const filter = ref<string | null>(null);
const selectedAtlas = ref<string | null>(null);
const atlases = ref<string[]>([]);
const favorites = ref<string[]>([]);

// Sorted atlas views.
const sortedAtlases = computed(() =>
  [...atlases.value].sort((a, b) => a.localeCompare(b))
);
const sortedFavorites = computed(() =>
  [...favorites.value].sort((a, b) => a.localeCompare(b))
);

async function connect() {
  // Disconnect if no source.
  if (!atlasSource.value) {
    connectionStatus.value = ConnectionStatus.Disconnected;
    return;
  }

  // Set to connecting.
  connectionStatus.value = ConnectionStatus.Connecting;

  try {
    // Make a connection.
    const response = await api.get<AtlasSourceResponse>(atlasSource.value);

    // Parse the response.
    if (response.data) {
      atlases.value = response.data.files
        .filter(item => item.type === "folder")
        .map(item => item.name);
      connectionStatus.value = ConnectionStatus.Connected;
    } else {
      notifyFail();
    }
  } catch (e) {
    notifyFail();
  }

  /**
   * Notify if a connection fails and set the connection status to disconnected.
   */
  function notifyFail() {
    $q.notify({
      message: "Unable to access atlases from source.",
      caption: "Check source URL and try again.",
      color: "negative",
      icon: "mobiledata_off"
    });
    connectionStatus.value = ConnectionStatus.Disconnected;
  }
}

/**
 * Move an atlas into favorites.
 */
function addToFavorites(atlas: string) {
  // Validate selected atlas.
  const selectionIndex = atlases.value.indexOf(atlas);
  if (selectionIndex === -1) return;

  // Move.
  atlases.value.splice(selectionIndex, 1);
  favorites.value.push(atlas);
}

/**
 * Move an atlas out of favorites.
 */
function removeFromFavorites(atlas: string) {
  // Validate selected atlas.
  const selectionIndex = favorites.value.indexOf(atlas);
  if (selectionIndex === -1) return;

  // Move.
  favorites.value.splice(selectionIndex, 1);
  atlases.value.push(atlas);
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">Atlas Source</p>

    <div class="row q-gutter-x-md">
      <q-btn
        color="primary"
        icon="public"
        label="Pinpoint Atlases"
        @click="
          atlasSource =
            'https://virtualbrainlab.alleninstitute.org/pinpoint/atlases'
        "
      />
      <q-btn
        icon="home"
        label="Locally Hosted"
        @click="atlasSource = 'http://localhost:3000'"
      />
    </div>

    <q-input v-model="atlasSource" class="col" clearable label="Source URL" />

    <q-btn
      :loading="connectionStatus === ConnectionStatus.Connecting"
      color="primary"
      label="Connect"
      @click="connect"
    />

    <template v-if="connectionStatus === ConnectionStatus.Connected">
      <q-input v-model="filter" clearable label="Filter atlases" />
      <q-list class="atlas-list">
        <template v-if="sortedFavorites.length > 0">
          <q-item
            v-for="atlasName in sortedFavorites"
            :active="atlasName === selectedAtlas"
            v-ripple
            clickable
            @click="selectedAtlas = atlasName"
          >
            <q-item-section>{{ atlasName }}</q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                color="pink"
                icon="favorite"
                @click.stop="removeFromFavorites(atlasName)"
              />
            </q-item-section>
          </q-item>
          <q-separator />
        </template>

        <template v-if="sortedAtlases.length > 0">
          <q-item
            v-for="atlasName in sortedAtlases"
            :active="atlasName === selectedAtlas"
            v-ripple
            clickable
            @click="selectedAtlas = atlasName"
          >
            <q-item-section>{{ atlasName }}</q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                icon="favorite_border"
                @click.stop="addToFavorites(atlasName)"
              />
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </template>
  </q-form>
</template>

<style lang="sass" scoped>
.atlas-list
  max-height: 30vh
  overflow-y: auto
</style>
