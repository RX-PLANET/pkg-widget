<template>
    <div id="app">
        <h1>IRuxu Pkg Widget</h1>
        <Logo></Logo>

        <UploadImage :upload-fn="uploadImage" :domain="domain" :url="avatar"></UploadImage>

        <langSelect :show-flag="false"
                    :show-name="true"
                    :optionsWithFlag="false"></langSelect>
        <pay></pay>
    </div>
</template>

<script>
import Logo from "./components/common/logo.vue";
import UploadImage from "./components/common/upload-image.vue";
import {upload} from "./assets/data/upload";
import langSelect from "./components/common/lang-select.vue";
import pay from "./demo/pay-dialog-demo.vue";
export default {
    name: "App",
    components: {
        Logo,
        UploadImage,
        langSelect,
        pay
    },
    data() {
        return {
            app: "miipet",
            active: "sixth",

            domain: "https://cdn.iruxu.com/",
            avatar: "user/avatar/2024/11/27/81348085.jpeg",

            show: true
        };
    },
    methods: {
        uploadImage(file) {
            return upload(file)
        }
    }
};
</script>

<style lang="less">
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
}
</style>
