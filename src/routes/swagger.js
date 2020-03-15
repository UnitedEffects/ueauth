import ref from 'json-schema-ref-parser';
import merge from 'json-schema-resolve-allof';
import yaml from 'yamljs';
const swag = yaml.load('./swagger.yaml');
let doc = swag;
(async()=>{
    doc = await merge(await ref.dereference(swag));
})();

export default doc;