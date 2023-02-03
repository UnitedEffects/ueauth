import ref from 'json-schema-ref-parser';
import merge from 'json-schema-resolve-allof';
import yaml from 'yamljs';
import fs from 'fs';
const swag = yaml.parse(fs.readFileSync('./swagger.yaml', 'utf8'));
const clean = yaml.parse(fs.readFileSync('./swagger.clean.yaml', 'utf8'));
let doc = swag;
let prod = clean;
(async()=>{
	doc = await merge(await ref.dereference(swag));
	prod = await merge(await ref.dereference(clean));
})();

export default { doc, prod };