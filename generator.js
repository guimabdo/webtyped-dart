function generator(abstractions){
    //Path and contents =>  { path: '', contents: '' }
    let result = [];
    for(let a of abstractions){
        let path = createPath(a.path);
        let content;

        
        switch(a.kind){
            case 'Service':
                content = createServiceContent(a);
                break;
            case 'Model':
                content = createModelContent(a);
                break;
            case 'Enum':
                content = createEnumContent(a);
                break;
        }

        let f = { path: path, content: content };
        result.push(f);
    }

    return result;
}

function createPath(path){
    let splitted = path.split(/[\/\\]/);
    for(let i = 0; i < splitted.length; i++){
        if(splitted[i] == '..'){ splitted[i] = '##'; }
        if(splitted[i] == '.'){ splitted[i] = '#'; }
    }

    path = splitted.join('/');
    path = path.replace(/[\.\-]/g, '_');
    path = path.replace(/\.?([A-Z])/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "");

    path = path.replace(/#/g, '.');

    path += '.dart';
    return path;
}

function createServiceContent(s){
    let content = '';

    content += `import 'dart:convert';\n`;
    content += `import 'package:http/http.dart' as http;\n\n`;
    content += `class ${s.className} {\n`;
    content += '    String _endpoint;\n';
    content += '    constructor(String baseUrl) {\n';
    content += `        this._endpoint = baseUrl + '${s.endpoint}';\n`
    content += '    }\n';

    for(let a of s.actions){
        let parameters = a.parameters.map(p => resolveType(p.type) + ' ' + p.name);
        let resolvedReturnType = resolveType(a.returnType);
        if(!a.returnType.isKnown && resolvedReturnType != 'void'){
            resolvedReturnType = 'dynamic';
        }

        content += '\n';
        content += `    Future<${resolvedReturnType}> ${a.functionName}(${parameters}) async {\n`
        content += `        final response = await http.${a.httpMethod.toLowerCase()}(this._endpoint + '/' + '${a.actionName}');\n`;
        content += `        if(response.statusCode == 200) { \n`;
        if(resolvedReturnType != 'void'){
            if(a.returnType.isKnown){
                content += `            return ${resolvedReturnType}.fromJson(json.decode(response.body));\n`;
            }else{
                content += `            return json.decode(response.body);\n`;
            }
            
            /*
            if(resolvedReturnType.startsWith('List<')){
                let genArg0 = resolveType(a.returnType.genericArguments[0]);
                content += `            return json.decode(response.body).map((Map model) => ${genArg0}.fromJson(model)).toList(); ${resolvedReturnType}.fromJson(json.decode(response.body));\n`;
                //content += `            var decoded = json.decode(response.body);\n`;
                //content += `            var list = decoded.map((Map model) => ) new ${resolvedReturnType}();\n`;
                //content += `            return list;\n`;
            }else if(a.returnType.isKnown){
                content += `            return ${resolvedReturnType}.fromJson(json.decode(response.body));\n`;
            }
            */
        }
        content += `        } else {\n`;
        content += `            throw Exception('Api call failed');\n`;
        content += `        }\n`;
        content += `    }\n`;
    }

    content += '}';

     //Append imports
     for(let i in s.imports){
         //console.log(i);
        let importPath = createPath(i);
        let alias = s.imports[i];
        if(content.indexOf(alias) > 0){
            content = `import '${importPath}' as ${s.imports[i]};\n` + content;
        }
    }

    return content;
}

function createModelContent(a){
    let content = '';

    //Create class declaration
    let declaration = a.type.constructedFrom.split('.').reverse()[0];
    let className = declaration;
    let cleanClassName = className.replace('<>', '');

    //If class is generic
    if(a.type.genericArguments){
        declaration = declaration.replace('<>', '<' + a.type.genericArguments.join(',') + '>');
    }

    //Check inheritance
    if(a.type.inherits){
        let inheritsOf = resolveType(a.type.inherits);
        if(inheritsOf && inheritsOf != 'Object'){
            declaration += ` extends ${inheritsOf}`;
        }
    }

    content += `class ${declaration} {\n`;
    for(let f of a.fields){
        if(f.name[0] == '_'){ continue; }
        let typeDeclaration = resolveType(f.typeResolution) || f.typeDeclaration;
        content += `    ${typeDeclaration} ${f.name};\n`;
    }

    content += '\n';
    //content += `    ${cleanClassName}({${a.fields.filter(f => f.name[0] != '_').map(f => `this.${f.name}`)}});\n`;
    content += `    ${cleanClassName}({${a.allFields.filter(f => f.name[0] != '_').map(f => `${f.name}`)}}) {\n`;
    for(let f of a.allFields){
        if(f.name[0] == '_'){ continue; }
        content += `        this.${f.name} = ${f.name};\n`;
    }
    content += '    }\n';
    content += '\n';
    content += `    factory ${cleanClassName}.fromJson(Map<String, dynamic> json) {\n`;
    content += `        return ${cleanClassName}(\n`;
    for(let f of a.allFields){
        if(f.name[0] == '_'){ continue; }
        content += `            ${f.name}: json['${f.name}'],\n`;
    }

    content += `        );\n`;
    content += `    }\n`;

    content += '}';

    //Append imports
    for(let i in a.imports){
        let importPath = createPath(i);
        let alias = a.imports[i];
        if(content.indexOf(alias) > 0){
            content = `import '${importPath}' as ${a.imports[i]};\n` + content;
        }
    }

    return content;
}

function createEnumContent(a){
    let content = `class ${a.name} {\n`;
    for(let val of a.values){
        content += `    static const ${val.name} = ${val.value};\n`;
    }
    content += '}';
    return content;
}


function resolveTypeCore(typeResolution){
    if(typeResolution.isEnum){ return 'int'; }
    switch(typeResolution.constructedFrom){
        case 'bool':
            return 'bool';
        case 'decimal':
            return 'double';
        case 'int':
        case 'long':
            return 'int';
        case 'object':
        case 'System.Object':
            return 'Object';
        case 'System.DateTime':
        case 'System.DateTimeOffset':
            return 'DateTime';
        case 'System.Guid':
        case 'string':
            return 'String';
        case 'System.Array<>':
        case 'System.Collections.Generic.List<>':
        case 'System.Collections.Generic.IEnumerable<>':
        case 'System.Linq.IQueryable<>':
            return 'List<{0}>';
        case 'System.Collections.Generic.Dictionary<,>':
            return 'Map<{0},{1}>';
        case 'System.Nullable<>':
            return '{0}';
        case 'System.Threading.Tasks.Task<>':
            return '{0}';
        case 'System.Threading.Tasks.Task':
            return 'void';
        default: 
            return null;
    }
}

function resolveType(typeResolution){
    let strType = resolveTypeCore(typeResolution);

    //Manage known types, may be not generic, or generic with n arguments
    if(!strType){
        if(typeResolution.isKnown){
            //Type name
            strType = typeResolution.constructedFrom.split('.').reverse()[0];

            //Generic?
            if(typeResolution.genericArguments){
                strType = strType.replace('<>', '');
                strType += '<';
                let args = [];
                for(let i = 0; i < typeResolution.genericArguments.length; i++){
                    args.push(`{${i}}`);
                }
                strType += args.join(',');
                strType += '>';
            }

            //From imported module?
            if(typeResolution.moduleAlias){
                strType = `${typeResolution.moduleAlias}.${strType}`;
            }
        }
    }

    //Apply generics
    if(strType && typeResolution.genericArguments){
        let i = 0;
        for(let gArg of typeResolution.genericArguments){
            let strArg = resolveGenericArgument(gArg);
            strType = strType.replace(`{${i}}`, strArg);
            i++;
        }
    }

    if(!strType){
        return 'Object' + '/*' + typeResolution.constructedFrom  + '*/';
        //console.log(typeResolution.constructedFrom);
    }

    return strType;
}

function resolveGenericArgument(typeResolutionOrString){
    if(typeof typeResolutionOrString === 'string'){ return typeResolutionOrString; }
    return resolveType(typeResolutionOrString) || typeResolutionOrString.name;
}

module.exports = generator;