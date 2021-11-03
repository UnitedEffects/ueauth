import ref from 'json-schema-ref-parser';
import merge from 'json-schema-resolve-allof';
import yaml from 'yamljs';
import fs from 'fs';
const swag = yaml.parse(fs.readFileSync('./swagger.yaml', 'utf8'));
let doc = swag;
(async()=>{
	doc = await merge(await ref.dereference(swag));
})();

export default doc;