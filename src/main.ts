import '@kitware/vtk.js/Rendering/OpenGL/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/OpenGL/Profiles/Volume';
import '@kitware/vtk.js/Rendering/OpenGL/Profiles/Glyph';
import 'primeicons/primeicons.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { setPipelinesBaseUrl, setPipelineWorkerUrl } from '@itk-wasm/image-io';
import itkConfig from '@/src/io/itk/itkConfig';
import App from './App.vue';
import { initItkWorker } from './io/itk/worker';
import { registerAllReaders } from './io/readers';
import { FILE_READERS } from './io';
import './global.css';

initItkWorker();

setPipelineWorkerUrl(itkConfig.pipelineWorkerUrl);
setPipelinesBaseUrl(itkConfig.imageIOUrl);

registerAllReaders(FILE_READERS);

const pinia = createPinia();

const app = createApp(App);
app.use(pinia);
app.mount('#app');
