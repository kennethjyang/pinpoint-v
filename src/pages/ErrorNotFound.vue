<script>
 /**
 * @file 404 page definition.
 */
</script>
<template>
  <div
    class="fullscreen bg-blue text-white text-center q-pa-md flex flex-center"
  >
    <div>
      <div style="font-size: 30vh"> {{ $t("errorNotFound.code") }} </div>

      <div class="text-h2" style="opacity: 0.4">
        {{ $t("errorNotFound.message") }}
      </div>

      <q-btn
        class="q-mt-xl"
        color="white"
        text-color="blue"
        unelevated
        to="/"
        :label="$t('errorNotFound.goHome')"
        no-caps
      />
    </div>
  </div>
</template>
