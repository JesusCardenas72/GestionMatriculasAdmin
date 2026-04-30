Flows:

Flow D — AdminEditarSolicitud

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/21dae1f40ab5449b80378e4b40bb8f91/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=cJAhWDu0mCUEuJ1OVElCiTgPD-wk9Cn5oTl9wGzCZog

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"rowId": {
"type": "string"
},
"nombre": {
"type": "string"
},
"apellidos": {
"type": "string"
},
"dni": {
"type": "string"
},
"email": {
"type": "string"
},
"telefono": {
"type": "string"
},
"fechaNacimiento": {
"type": "string"
},
"domicilio": {
"type": "string"
},
"localidad": {
"type": "string"
},
"provincia": {
"type": "string"
},
"cp": {
"type": "string"
},
"ensenanzaCurso": {
"type": "string"
},
"especialidad": {
"type": "string"
},
"formaPago": {
"type": "string"
},
"reduccionTasas": {
"type": "string"
},
"autorizacionImagen": {
"type": "boolean"
},
"disponibilidadManana": {
"type": "boolean"
},
"horaSalida": {
"type": "string"
}
},
"required": [
"rowId"
]
},
"method": "POST"
}
}

2. Condition

{
"type": "If",
"expression": {
"and": [
{
"equals": [
"triggerOutputs()?['headers']?['x-api-key']\n",
"i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto=\n"
]
}
]
},
"actions": {
"Update_a_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"recordId": "@triggerBody()?['rowId']",
"item/cpmmr_apellidos": "@triggerBody()?['apellidos']",
"item/cpmmr_autorizacionimagen": "@triggerBody()?['autorizacionImagen']",
"item/cpmmr_cp": "@triggerBody()?['cp']",
"item/cpmmr_disponibilidadmanana": "@triggerBody()?['disponibilidadManana']",
"item/cpmmr_dni": "@triggerBody()?['dni']",
"item/cpmmr_domicilio": "@triggerBody()?['domicilio']",
"item/cpmmr_email": "@triggerBody()?['email']",
"item/cpmmr_ensenanzaycurso": "@triggerBody()?['ensenanzaCurso']",
"item/cpmmr_especialidad": "@triggerBody()?['especialidad']",
"item/cpmmr_fechanacimiento": "@triggerBody()?['fechaNacimiento']",
"item/cpmmr_formadepago": "@triggerBody()?['formaPago']",
"item/cpmmr_horasalida": "@triggerBody()?['horaSalida']",
"item/cpmmr_localidad": "@triggerBody()?['localidad']",
"item/cpmmr_nombre": "@triggerBody()?['nombre']",
"item/cpmmr_provincia": "@triggerBody()?['provincia']",
"item/cpmmr_reducciontasas": "@triggerBody()?['reduccionTasas']",
"item/cpmmr_telefono": "@triggerBody()?['telefono']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "UpdateOnlyRecord"
}
}
},
"Response": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": {
"ok": true
}
},
"runAfter": {
"Update_a_row": [
"Succeeded"
]
}
}
},
"else": {
"actions": {
"Response_1": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 401,
"body": {
"error": "Unauthorized"
}
}
}
}
},
"runAfter": {}
}

=======================================================================
Flow E - AdminBorrarSolicitud

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/57ed354380e841a1b31fc0e674193ba7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tAMipMEMLpywHht-zemYJ5MjR7DPW8ZixYJf78Sl5WU

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"rowId": {
"type": "string"
}
},
"required": [
"rowId"
]
},
"method": "POST"
}
}

2. Condition

{
"type": "If",
"expression": {
"and": [
{
"equals": [
"@triggerOutputs()?['headers']?['x-api-key']",
"i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto="
]
}
]
},
"actions": {
"Delete_a_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"recordId": "@triggerBody()?['rowId']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "DeleteRecord"
}
}
},
"Response": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": {
"ok": true
}
},
"runAfter": {
"Delete_a_row": [
"Succeeded"
]
}
}
},
"else": {
"actions": {
"Response_1": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 401,
"body": {
"error": "Unauthorized"
}
}
},
"Terminate": {
"type": "Terminate",
"inputs": {
"runStatus": "Succeeded"
},
"runAfter": {
"Response_1": [
"Succeeded"
]
}
}
}
},
"runAfter": {}
}

=======================================================
Flow H - AdminGuardarAsignaturas

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e8e7f8c52b47417aa496c20e587bb98c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=iuIJ7gQv0RSkQ0xd56rvHwQ9nd6b_lkbNVtB8NVulAo

1. Request (trigger)
   {
   "type": "Request",
   "kind": "Http",
   "inputs": {
   "triggerAuthenticationType": "All",
   "schema": {
   "type": "object",
   "properties": {
   "matriculaId": {
   "type": "string"
   },
   "eliminados": {
   "type": "array",
   "items": {
   "type": "string"
   }
   },
   "actualizados": {
   "type": "array",
   "items": {
   "type": "object",
   "properties": {
   "matriculaAsignaturaId": {
   "type": "string"
   },
   "estado": {
   "type": "integer"
   },
   "observaciones": {
   "type": "string"
   }
   }
   }
   },
   "nuevos": {
   "type": "array",
   "items": {
   "type": "object",
   "properties": {
   "asignaturaId": {
   "type": "string"
   },
   "nombre": {
   "type": "string"
   },
   "estado": {
   "type": "integer"
   }
   }
   }
   }
   }
   },
   "method": "POST"
   }
   }

2. Condition

{
"type": "If",
"expression": {
"and": [
{
"equals": [
"@triggerOutputs()?['headers']?['x-api-key']",
"i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto="
]
}
]
},
"actions": {
"Apply*to_each*—_Eliminados": {
"type": "Foreach",
"foreach": "@triggerBody()?['eliminados']",
"actions": {
"Delete_a_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"recordId": "@items('Apply_to_each_—_Eliminados')\r\n"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "DeleteRecord"
}
}
}
}
},
"Apply_to_each_—_Actualizados": {
"type": "Foreach",
"foreach": "@triggerBody()?['actualizados']",
"actions": {
"Update_a_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"recordId": "@items('Apply_to_each_—_Actualizados')?['matriculaAsignaturaId']",
"item/cr955_estadoasignatura": "@items('Apply_to_each_—_Actualizados')?['estado']",
"item/cr955_observaciones": "@items('Apply_to_each_—_Actualizados')?['observaciones']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "UpdateOnlyRecord"
}
}
}
},
"runAfter": {
"Apply_to_each_—_Eliminados": [
"Succeeded"
]
}
},
"Apply_to_each_—_Nuevos": {
"type": "Foreach",
"foreach": "@triggerBody()?['nuevos']",
"actions": {
"Add_a_new_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"item/cr955_name": "@items('Apply_to_each_—_Nuevos')?['nombre']\r\n",
"item/cr955_codigomateria": "@items('Apply_to_each_—_Nuevos')?['codigo']",
"item/cr955_estadoasignatura": "@items('Apply_to_each_—_Nuevos')?['estado']\r\n",
"item/cr955_Matricula@odata.bind": "@concat('/cpmmr_matriculas(', triggerBody()?['matriculaId'], ')')\r\n"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
}
}
},
"runAfter": {
"Apply_to_each_—_Actualizados": [
"Succeeded"
]
}
},
"Response_1": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": {
"ok": true
}
},
"runAfter": {
"Apply_to_each_—\_Nuevos": [
"Succeeded"
]
}
}
},
"else": {
"actions": {
"Response": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 401,
"body": {
"error": "Unauthorized"
}
}
},
"Terminate": {
"type": "Terminate",
"inputs": {
"runStatus": "Succeeded"
},
"runAfter": {
"Response": [
"Succeeded"
]
}
}
}
},
"runAfter": {}
}

========================================================================
Flow G- AdminCatalogoAsignaturas

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/98e5275a1b4b4f7995f1985b6601a11e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fjnl3ZoIwzT6RW1lu-35e8wiMmvNpt4jjyV63UKt_xw

1. Request (trigger)
   {
   "type": "Response",
   "kind": "Http",
   "inputs": {
   "statusCode": 200,
   "headers": {
   "Content-Type": "application/json"
   },
   "body": "@json(concat('{\"asignaturas\":', string(outputs('List_rows')?['body/value']), '}'))"
   },
   "runAfter": {
   "List_rows": [
   "SUCCEEDED"
   ]
   }
   }

2. List rows
   {
   "type": "OpenApiConnection",
   "inputs": {
   "parameters": {
   "entityName": "cr955_asignaturases",
   "$select": "cr955_asignaturasid,cr955_coursecode,cr955_courseabbreviation,cr955_coursedescription,cr955_courselevel,cr955_educationtype,cr955_specialization,cr955_courseleveldescription",
      "$filter": "@concat('cr955_educationtype eq ''', triggerBody()?['ensenanza'], ''' and cr955_specialization eq ''', triggerBody()?['especialidad'], '''')"
   },
   "host": {
   "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
   "connection": "shared_commondataserviceforapps",
   "operationId": "ListRecords"
   }
   },
   "runAfter": {}
   }

3. Response

{
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": "@json(concat('{\"asignaturas\":', string(outputs('List_rows')?['body/value']), '}'))"
},
"runAfter": {
"List_rows": [
"SUCCEEDED"
]
}
}

=========================================================
Flow F - AdminListarAsignaturasSolicitud

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cc23e567631349f68b045c64efe630ee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=vOTdVC7hYXBFPyhcgVzQAb9VHajBgCYIzy30deV4g4k

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"matriculaId": {
"type": "string"
}
},
"required": [
"matriculaId"
]
},
"method": "POST"
},
"metadata": {
"operationMetadataId": "5d447c6f-56db-4da4-a67c-ea0970e77401"
}
}

2. Condition

{{
"type": "If",
"expression": {
"equals": [
"@triggerOutputs()?['headers']?['x-api-key']",
"i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto="
]
},
"actions": {
"Enumerar_filas": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"$select": "cr955_matriculaasignaturaid,cr955_name,cr955_estadoasignatura,cr955_observaciones,_cr955_asignatura_value",
          "$filter": "\_cr955_matricula_value eq '@{triggerBody()?['matriculaId']}'"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
},
"metadata": {
"operationMetadataId": "eb2c26bc-2533-4cc6-8230-bb717964f214"
}
},
"Respuesta": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": "@json(concat('{\"asignaturas\":', string(outputs('Enumerar_filas')?['body/value']), '}'))"
},
"runAfter": {
"Enumerar_filas": [
"Succeeded"
]
},
"metadata": {
"operationMetadataId": "85d2215a-7946-42e6-8852-432e53ca4eac"
}
}
},
"else": {
"actions": {
"Respuesta_2": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 401,
"body": {
"error": "Unauthorized"
}
},
"metadata": {
"operationMetadataId": "ef3f2e18-fd2b-499e-a68f-e3ad246aaefe"
}
}
}
},
"runAfter": {},
"metadata": {
"operationMetadataId": "27abc231-fb0f-4d23-8d76-8dfdc2af02cc"
}
}

=======================================================
AdminListarSolicitudes

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"estado": {
"type": "integer"
},
"busqueda": {
"type": "string"
}
}
},
"method": "POST"
},
"metadata": {
"operationMetadataId": "1c161352-786c-4880-bb57-da12170aaa86"
}
}

2. Condition

{
"type": "If",
"expression": {
"and": [
{
"equals": [
"@triggerOutputs()?['headers']?['x-api-key']",
"i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto="
]
}
]
},
"actions": {
"List_rows": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"$select": "cpmmr_matriculaid,cpmmr_nombrematricula,cpmmr_nombre,cpmmr_apellidos,cpmmr_dni,cpmmr_email,cpmmr_telefono,cpmmr_fechanacimiento,cpmmr_domicilio,cpmmr_localidad,cpmmr_provincia,cpmmr_cp,cpmmr_fechadeinscripcion,cpmmr_ensenanzaycurso,cpmmr_especialidad,cpmmr_formadepago,cpmmr_reducciontasas,cpmmr_autorizacionimagen,cpmmr_disponibilidadmanana,cpmmr_horasalida,cpmmr_estado,cr955_docfaltante",
          "$filter": "@if(equals(coalesce(triggerBody()?['estado'], ''), ''), 'cpmmr_matriculaid ne null', concat('cpmmr_estado eq ', triggerBody()?['estado']))",
"$orderby": "cpmmr_fechadeinscripcion desc"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
},
"metadata": {
"operationMetadataId": "4025c66d-e33f-4f92-8e3c-2eb2dbafbeb0"
}
},
"Response_1": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": "@json(concat('{\"solicitudes\":', string(outputs('List_rows')?['body/value']), ',\"total\":', length(outputs('List_rows')?['body/value']), '}'))"
},
"runAfter": {
"List_rows": [
"Succeeded"
]
},
"metadata": {
"operationMetadataId": "b97e118f-b240-4041-8851-b69012e2081b"
}
}
},
"else": {
"actions": {
"Response": {
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 401,
"body": {
"error": "Unauthorized"
}
},
"metadata": {
"operationMetadataId": "2a491165-653c-431d-acc4-67466b30e7f9"
}
},
"Terminate": {
"type": "Terminate",
"inputs": {
"runStatus": "Succeeded"
},
"runAfter": {
"Response": [
"Succeeded"
]
},
"metadata": {
"operationMetadataId": "918c75ce-8370-4da1-9ecb-642a316dc2f6"
}
}
}
},
"runAfter": {},
"metadata": {
"operationMetadataId": "c4bd3867-1c48-48fe-8246-942ea996302e"
}
}

====================================================================================================================

AdminObtenerPDF

1. Request (trigger)
   {
   "type": "Request",
   "kind": "Http",
   "inputs": {
   "triggerAuthenticationType": "All",
   "schema": {
   "type": "object",
   "properties": {
   "rowId": {
   "type": "string"
   }
   },
   "required": [
   "rowId"
   ]
   }
   },
   "metadata": {
   "operationMetadataId": "90503b01-361b-47d8-b4b2-36f563e4b472"
   }
   }

2. Condition
   {
   "type": "If",
   "expression": {
   "and": [
   {
   "equals": [
   "@triggerOutputs()?['headers']?['x-api-key']",
   "i9VetqyFQ2NiUOlWafHdavLsZwzblpfJxgAVpDKvqto="
   ]
   }
   ]
   },
   "actions": {
   "Response_1": {
   "type": "Response",
   "kind": "Http",
   "inputs": {
   "statusCode": 200,
   "headers": {
   "Content-Type": "application/json"
   },
   "body": {
   "fileName": "solicitud.pdf",
   "mimeType": "@{body('Download_a_file_or_an_image')?['$content-type']}",
   "contentBase64": "@{body('Download_a_file_or_an_image')?['$content']}"
   }
   },
   "runAfter": {
   "Download_a_file_or_an_image": [
   "Succeeded"
   ]
   },
   "metadata": {
   "operationMetadataId": "969ef1ee-aad7-46a9-a101-13fc24a7c8eb"
   }
   },
   "Download_a_file_or_an_image": {
   "type": "OpenApiConnection",
   "inputs": {
   "parameters": {
   "entityName": "cpmmr_matriculas",
   "recordId": "@triggerBody()?['rowId']",
   "fileImageFieldName": "cpmmr_solicitudpdf"
   },
   "host": {
   "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
   "connection": "shared_commondataserviceforapps",
   "operationId": "GetEntityFileImageFieldContent"
   }
   },
   "metadata": {
   "operationMetadataId": "834d7740-a2aa-42ad-8cd9-27ebecb50af0"
   }
   }
   },
   "else": {
   "actions": {
   "Response": {
   "type": "Response",
   "kind": "Http",
   "inputs": {
   "statusCode": 401,
   "body": {
   "error": "Unauthorized"
   }
   },
   "metadata": {
   "operationMetadataId": "ac21fec8-082e-475f-80b7-c6f3072cc4be"
   }
   }
   }
   },
   "runAfter": {},
   "metadata": {
   "operationMetadataId": "e3e6760b-024d-4f03-9c8d-c253ba34b25f"
   }
   }

**Duplicados+NOrden**

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b62c3d4b21d24bda8daa75a8586198eb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=4nqPljifCY1CBxAiKj03La2YEksNn78meKn9-nlXGCk

1.Request (trigger)
{

&#x20; "type": "Request",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "triggerAuthenticationType": "All",

&#x20; "schema": {

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "schema": {

&#x20; "type": "object",

&#x20; "properties": {

&#x20; "nombre": {

&#x20; "type": "string"

&#x20; },

&#x20; "apellidos": {

&#x20; "type": "string"

&#x20; },

&#x20; "dni": {

&#x20; "type": "string"

&#x20; },

&#x20; "especialidad": {

&#x20; "type": "string"

&#x20; },

&#x20; "tipoEnsenanza": {

&#x20; "type": "string"

&#x20; },

&#x20; "curso": {

&#x20; "type": "string"

&#x20; }

&#x20; }

&#x20; },

&#x20; "triggerAuthenticationType": "All"

&#x20; }

&#x20; }

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "d9b953cf-00ac-4e2a-b40a-d8acb07cd344"

&#x20; }

}

2. Inicializar variable
   {

&#x20; "type": "InitializeVariable",

&#x20; "inputs": {

&#x20; "variables": \[

&#x20; {

&#x20; "name": "EnsenanzaCurso",

&#x20; "type": "string",

&#x20; "value": "@{concat(if(equals(triggerBody()?\['tipoEnsenanza'],'elemental'),'EE','EP'), replace(replace(replace(replace(replace(replace(triggerBody()?\['curso'],'1º','1'),'2º','2'),'3º','3'),'4º','4'),'5º','5'),'6º','6'))}"

&#x20; }

&#x20; ]

&#x20; },

&#x20; "runAfter": {},

&#x20; "metadata": {

&#x20; "operationMetadataId": "3d947170-5a98-4e3b-b209-7dca41aeca21"

&#x20; }

}

3.Enumerar filas
{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"$select": "cpmmr_matriculaid",
      "$filter": "\tcpmmr_dni eq '@{triggerBody()?['dni']}' and cpmmr_especialidad eq '@{triggerBody()?['especialidad']}' and cpmmr_ensenanzaycurso eq '@{variables('EnsenanzaCurso')}'",
"$top": 1
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
},
"runAfter": {
"Inicializar_variable": [
"Succeeded"
]
},
"metadata": {
"operationMetadataId": "89a04fe8-2c85-4a47-a26c-866d97da8c58"
}
}

5. Condition: length(body('Enumerar_filas')?\['value'])is greather than 0

5.1. True:{

&#x20; "type": "Response",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "statusCode": 409,

&#x20; "headers": {

&#x20; "Content-Type": "application/json"

&#x20; },

&#x20; "body": {

&#x20; "ok": false,

&#x20; "reason": "duplicate",

&#x20; "contact": {

&#x20; "phone": "926 274 154",

&#x20; "email": "13004341.cpm@educastillalamancha.es"

&#x20; }

&#x20; }

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "f0450195-07e4-4705-87e8-a67567945b18"

&#x20; }

}

5.2. False

5.2.1. Enumerar filas 2
{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"$select": "cpmmr_matriculaid",
      "$top": 5000
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
}
}

5.2.2. Respuesta 2
{
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": {
"Content-Type": "application/json"
},
"body": {
"ok": true,
"requestNumber": "@{concat(utcNow('yyyy'), '-', string(add(int(utcNow('yyyy')), 1)), '-', string(add(length(body('Enumerar_filas_2')?['value']), 1)))}"
}
},
"runAfter": {
"Enumerar_filas_2": [
"Succeeded"
]
}
}

===========================================================================================================
**JSON con PDF**

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b31521c981d04d95a8a6917a899f3988/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=i6YvgMW9GNJO-1Ynz0A3hAiNPGvZVpXkzbsdoeBYsfU

1.Request (trigger)
{

&#x20; "type": "Request",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "triggerAuthenticationType": "All",

&#x20; "schema": {

&#x20; "type": "object",

&#x20; "properties": {

&#x20; "rowId": {

&#x20; "type": "string"

&#x20; },

&#x20; "fileName": {

&#x20; "type": "string"

&#x20; },

&#x20; "mimeType": {

&#x20; "type": "string"

&#x20; },

&#x20; "contentBase64": {

&#x20; "type": "string"

&#x20; },

&#x20; "nombre": {

&#x20; "type": "string"

&#x20; },

&#x20; "apellidos": {

&#x20; "type": "string"

&#x20; },

&#x20; "email": {

&#x20; "type": "string"

&#x20; },

&#x20; "tipoCurso": {

&#x20; "type": "string"

&#x20; },

&#x20; "especialidad": {

&#x20; "type": "string"

&#x20; },

&#x20; "asignaturaPendiente1": {

&#x20; "type": "string"

&#x20; },

&#x20; "asignaturaPendiente2": {

&#x20; "type": "string"

&#x20; },

&#x20; "perfil": {

&#x20; "type": "string"

&#x20; },

&#x20; "formaPago": {

&#x20; "type": "string"

&#x20; },

&#x20; "reduccion": {

&#x20; "type": "string"

&#x20; },

&#x20; "importeTotal": {

&#x20; "type": "string"

&#x20; },

&#x20; "importe1erPago": {

&#x20; "type": "string"

&#x20; },

&#x20; "importe2oPago": {

&#x20; "type": "string"

&#x20; }

&#x20; }

&#x20; }

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "5006a095-d9e3-4734-a9ab-7e76c54c35af"

&#x20; }

}

2.{

&#x20; "type": "Request",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "triggerAuthenticationType": "All",

&#x20; "schema": {

&#x20; "type": "object",

&#x20; "properties": {

&#x20; "rowId": {

&#x20; "type": "string"

&#x20; },

&#x20; "fileName": {

&#x20; "type": "string"

&#x20; },

&#x20; "mimeType": {

&#x20; "type": "string"

&#x20; },

&#x20; "contentBase64": {

&#x20; "type": "string"

&#x20; },

&#x20; "nombre": {

&#x20; "type": "string"

&#x20; },

&#x20; "apellidos": {

&#x20; "type": "string"

&#x20; },

&#x20; "email": {

&#x20; "type": "string"

&#x20; },

&#x20; "tipoCurso": {

&#x20; "type": "string"

&#x20; },

&#x20; "especialidad": {

&#x20; "type": "string"

&#x20; },

&#x20; "asignaturaPendiente1": {

&#x20; "type": "string"

&#x20; },

&#x20; "asignaturaPendiente2": {

&#x20; "type": "string"

&#x20; },

&#x20; "perfil": {

&#x20; "type": "string"

&#x20; },

&#x20; "formaPago": {

&#x20; "type": "string"

&#x20; },

&#x20; "reduccion": {

&#x20; "type": "string"

&#x20; },

&#x20; "importeTotal": {

&#x20; "type": "string"

&#x20; },

&#x20; "importe1erPago": {

&#x20; "type": "string"

&#x20; },

&#x20; "importe2oPago": {

&#x20; "type": "string"

&#x20; }

&#x20; }

&#x20; }

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "5006a095-d9e3-4734-a9ab-7e76c54c35af"

&#x20; }

}

3.{

&#x20; "type": "OpenApiConnection",

&#x20; "inputs": {

&#x20; "parameters": {

&#x20; "entityName": "cpmmr_matriculas",

&#x20; "recordId": "@triggerBody()?\['rowId']"

&#x20; },

&#x20; "host": {

&#x20; "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",

&#x20; "connection": "shared_commondataserviceforapps",

&#x20; "operationId": "GetItem"

&#x20; }

&#x20; },

&#x20; "runAfter": {

&#x20; "Cargar_un_archivo_o_una_imagen": \[

&#x20; "Succeeded"

&#x20; ]

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "0888a9d9-e979-4015-af33-aca728fef7dd"

&#x20; }

}

4\. {

&#x20; "type": "OpenApiConnection",

&#x20; "inputs": {

&#x20; "parameters": {

&#x20; "emailMessage/To": "@triggerBody()?\['email']\\r\\n",

&#x20; "emailMessage/Subject": "Solicitud de matrícula RECIBIDA — CPM Marcos Redondo (Ciudad Real)\\n",

&#x20; "emailMessage/Body": "<div style=\\"font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:680px;margin:0 auto\\">\\n\\n <!-- Cabecera -->\\n <div style=\\"background:#1e40af;padding:20px 24px;border-radius:8px 8px 0 0\\">\\n <p style=\\"color:#ffffff;font-size:18px;font-weight:bold;margin:0\\">\\n Conservatorio Profesional de Música \\"Marcos Redondo\\"\\n </p>\\n <p style=\\"color:#bfdbfe;font-size:13px;margin:4px 0 0\\">Ciudad Real</p>\\n </div>\\n\\n <!-- Mensaje principal -->\\n <div style=\\"background:#f0fdf4;border:1px solid #86efac;padding:16px 24px;margin:0\\">\\n <p style=\\"margin:0;font-size:15px\\">\\n ✅ Estimado/a <b>@{triggerBody()?\['nombre']} @{triggerBody()?\['apellidos']}</b>,\\n </p>\\n <p style=\\"margin:8px 0 0;color:#166534\\">\\n Hemos recibido correctamente tu solicitud de matrícula. A continuación tienes el resumen de los datos enviados. Consérvalo como justificante.\\n </p>\\n </div>\\n\\n <!-- DATOS PERSONALES -->\\n <div style=\\"padding:16px 24px 0\\">\\n <p style=\\"font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px\\">\\n Datos Personales\\n </p>\\n <table style=\\"width:100%;border-collapse:collapse;font-size:13px\\">\\n <tbody><tr>\\n <td style=\\"padding:6px 8px;color:#6b7280;width:40%\\">Nombre y apellidos</td>\\n <td style=\\"padding:6px 8px;font-weight:bold\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_nombre']} @{outputs('Get_a_row_by_ID')?\['body/cpmmr_apellidos']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">DNI / NIE</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_dni']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Fecha de nacimiento</td>\\n <td style=\\"padding:6px 8px\\">@{formatDateTime(outputs('Get_a_row_by_ID')?\['body/cpmmr_fechanacimiento'], 'dd-MM-yyyy')}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Domicilio</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_domicilio']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Localidad</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_localidad']} (@{outputs('Get_a_row_by_ID')?\['body/cpmmr_provincia']}) — CP @{outputs('Get_a_row_by_ID')?\['body/cpmmr_cp']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Email</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_email']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Teléfono</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_telefono']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Hora salida estudios</td>\\n <td style=\\"padding:6px 8px\\">@{outputs('Get_a_row_by_ID')?\['body/cpmmr_horasalida']}</td>\\n </tr>\\n </tbody></table>\\n </div>\\n\\n <!-- DATOS DE MATRÍCULA -->\\n <div style=\\"padding:16px 24px 0\\">\\n <p style=\\"font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px\\">\\n Datos de Matriculación\\n </p>\\n <table style=\\"width:100%;border-collapse:collapse;font-size:13px\\">\\n <tbody><tr>\\n <td style=\\"padding:6px 8px;color:#6b7280;width:40%\\">Tipo / Curso</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['tipoCurso']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Especialidad</td>\\n <td style=\\"padding:6px 8px;font-weight:bold\\">@{triggerBody()?\['especialidad']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Asignatura pendiente 1</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['asignaturaPendiente1']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Asignatura pendiente 2</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['asignaturaPendiente2']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Perfil profesional</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['perfil']}</td>\\n </tr>\\n </tbody></table>\\n </div>\\n\\n <!-- FORMA DE PAGO -->\\n <div style=\\"padding:16px 24px 0\\">\\n <p style=\\"font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px\\">\\n Forma de Pago\\n </p>\\n <table style=\\"width:100%;border-collapse:collapse;font-size:13px\\">\\n <tbody><tr>\\n <td style=\\"padding:6px 8px;color:#6b7280;width:40%\\">Modalidad</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['formaPago']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Reducción aplicada</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['reduccion']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">Importe total</td>\\n <td style=\\"padding:6px 8px;font-weight:bold;font-size:15px\\">@{triggerBody()?\['importeTotal']}</td>\\n </tr>\\n <tr style=\\"background:#f9fafb\\">\\n <td style=\\"padding:6px 8px;color:#6b7280\\">1er pago</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['importe1erPago']}</td>\\n </tr>\\n <tr>\\n <td style=\\"padding:6px 8px;color:#6b7280\\">2º pago</td>\\n <td style=\\"padding:6px 8px\\">@{triggerBody()?\['importe2oPago']}</td>\\n </tr>\\n </tbody></table>\\n </div>\\n\\n <!-- Pie -->\\n <div style=\\"background:#f3f4f6;padding:16px 24px;margin-top:20px;border-top:1px solid #e5e7eb;border-radius:0 0 8px 8px;font-size:12px;color:#6b7280\\">\\n <p style=\\"margin:0\\">Si tienes cualquier duda, puedes contactarnos en:</p>\\n <p style=\\"margin:6px 0 0\\">📞 <b>926 27 41 54</b> \&nbsp;|\&nbsp; ✉️ <a href=\\"mailto:13004341.cpm@educastillalamancha.es\\" style=\\"color:#1e40af\\">13004341.cpm@educastillalamancha.es</a></p>\\n <p style=\\"margin:10px 0 0\\">Un saludo,<br><b>Secretaría del CPM \\"Marcos Redondo\\"</b> — Ciudad Real</p>\\n </div>\\n\\n</div>",

&#x20; "emailMessage/From": "13004341.cpm@educastillalamancha.es"

&#x20; },

&#x20; "host": {

&#x20; "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365",

&#x20; "connection": "shared_office365",

&#x20; "operationId": "SendEmailV2"

&#x20; }

&#x20; },

&#x20; "runAfter": {

&#x20; "Get_a_row_by_ID": \[

&#x20; "Succeeded"

&#x20; ]

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "e4de44c4-0667-4aa3-a9f0-cd94a0d203af"

&#x20; }

}

5.{

&#x20; "type": "Response",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "statusCode": 200,

&#x20; "headers": {

&#x20; "content-Type": "application/json"

&#x20; }

&#x20; },

&#x20; "runAfter": {

&#x20; "Enviar_correo_electrónico\_(V2)": \[

&#x20; "Succeeded"

&#x20; ]

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "51dac5ed-9041-4748-a88d-e8751047a609"

&#x20; }

}

====================================================================================================================
**JSON con todos los datos**

URL: https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ec7a2a1c67974d32ba23de811d20e93d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3G39Rx3ZC55SKVIoBGvRufw-d6J6fYl74GOi46We9f0

1.Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"nombre": {
"type": "string"
},
"apellidos": {
"type": "string"
},
"dni": {
"type": "string"
},
"fechaNacimiento": {
"type": "string"
},
"domicilio": {
"type": "string"
},
"localidad": {
"type": "string"
},
"provincia": {
"type": "string"
},
"codigoPostal": {
"type": "string"
},
"email": {
"type": "string"
},
"telefono": {
"type": "string"
},
"horaSalidaEstudios": {
"type": "string"
},
"disponibilidadManana": {
"type": "boolean"
},
"autorizacionImagen": {
"type": "boolean"
},
"tutor1Nombre": {
"type": "string"
},
"tutor1Dni": {
"type": "string"
},
"tutor2Nombre": {
"type": "string"
},
"tutor2Dni": {
"type": "string"
},
"tipoEnsenanza": {
"type": "string"
},
"curso": {
"type": "string"
},
"ensenanzaCurso": {
"type": "string"
},
"especialidad": {
"type": "string"
},
"asignaturaPendiente1": {
"type": "string"
},
"asignaturaPendiente2": {
"type": "string"
},
"perfilProfesional": {
"type": "string"
},
"formaPago": {
"type": "string"
},
"familiaNumerosa": {
"type": "boolean"
},
"tipoReduccion": {
"type": "string"
},
"convalidacionSolicitada": {
"type": "boolean"
},
"convalidacionAsignaturas": {
"type": "string"
},
"matriculaHonor": {
"type": "boolean"
},
"esPrimerAno": {
"type": "boolean"
},
"importeTotal": {
"type": "string"
},
"importe1erPago": {
"type": "string"
},
"importe2oPago": {
"type": "string"
},
"nOrden": {
"type": "string"
},
"estado": {
"type": "string"
},
"asignaturas": {
"type": "array",
"items": {
"type": "object",
"properties": {
"codigo": {
"type": "string"
},
"nombre": {
"type": "string"
},
"tipo": {
"type": "string"
}
}
}
}
}
}
},
"metadata": {
"operationMetadataId": "2f12d8a8-58b3-498c-a670-d204086f3451"
}
}

2.Inicializar variable

{
"type": "InitializeVariable",
"inputs": {
"variables": [
{
"name": "EnsenanzaCurso",
"type": "string",
"value": "concat(\n if(equals(triggerBody()?['tipoEnsenanza'], 'elemental'), 'EE', 'EP'),\n replace(replace(replace(replace(replace(replace(\n triggerBody()?['curso'],\n '1º','1'),'2º','2'),'3º','3'),'4º','4'),'5º','5'),'6º','6')\n)"
}
]
},
"runAfter": {},
"metadata": {
"operationMetadataId": "af02b414-88da-4602-bae5-b96fdd759dcd"
}
}

3. Dataverse

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"x-ms-odata-metadata-full": true,
"item/cpmmr_apellidos": "@triggerBody()?['apellidos']",
"item/cpmmr_autorizacionimagen": "@triggerBody()?['autorizacionImagen']",
"item/cr955_convalidacionsolicitada": "@triggerBody()?['convalidacionSolicitada']",
"item/cpmmr_cp": "@triggerBody()?['codigoPostal']",
"item/cpmmr_disponibilidadmanana": "@triggerBody()?['disponibilidadManana']",
"item/cpmmr_dni": "@triggerBody()?['dni']",
"item/cpmmr_domicilio": "@triggerBody()?['domicilio']",
"item/cpmmr_email": "@triggerBody()?['email']",
"item/cpmmr_ensenanzaycurso": "@triggerBody()?['ensenanzaCurso']\r\n",
"item/cpmmr_especialidad": "@triggerBody()?['especialidad']",
"item/cpmmr_fechanacimiento": "@triggerBody()?['fechaNacimiento']",
"item/cpmmr_formadepago": "@triggerBody()?['formaPago']",
"item/cpmmr_horasalida": "@triggerBody()?['horaSalidaEstudios']",
"item/cpmmr_localidad": "@triggerBody()?['localidad']",
"item/cpmmr_nombre": "@triggerBody()?['nombre']",
"item/cpmmr_provincia": "@triggerBody()?['provincia']",
"item/cpmmr_reducciontasas": "@triggerBody()?['tipoReduccion']",
"item/cpmmr_telefono": "@triggerBody()?['telefono']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
},
"runAfter": {
"Inicializar_variable": [
"Succeeded"
]
},
"metadata": {
"operationMetadataId": "3b052bbb-f06e-4d13-8dc1-1f3adcbea36d"
}
}

4. Aply to each

{
"type": "Foreach",
"foreach": "@triggerBody()?['asignaturas']",
"actions": {
"Add_a_new_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"item/cr955_name": "@items('Apply_to_each')?['nombre']",
"item/cr955_Asignatura@odata.bind": "@concat('/cr955_asignaturases(',first(outputs('List_rows')?['body/value'])?['cr955_asignaturasid'],')')",
"item/cr955_estadoasignatura": "@if(equals(items('Apply_to_each')?['tipo'],'Convalidacion'),904390001,if(equals(items('Apply_to_each')?['tipo'],'Pendiente'),904390004,904390000))",
"item/cr955_Matricula@odata.bind": "@concat('/cpmmr_matriculas(',outputs('Dataverse')?['body/cpmmr_matriculaid'],')')"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
},
"runAfter": {
"List_rows": [
"Succeeded"
]
}
},
"List_rows": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_asignaturases",
"$filter": "@concat('cr955_coursecode eq ',items('Apply_to_each')?['codigo'])",
          "$top": 1
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
}
}
},
"runAfter": {
"Dataverse": [
"Succeeded"
]
}
}

4.1. List rows

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_asignaturases",
"$filter": "@concat('cr955_coursecode eq ',items('Apply_to_each')?['codigo'])",
      "$top": 1
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "ListRecords"
}
}
}

4.2. Add a new row

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"item/cr955_name": "@items('Apply_to_each')?['nombre']",
"item/cr955_Asignatura@odata.bind": "@concat('/cr955_asignaturases(',first(outputs('List_rows')?['body/value'])?['cr955_asignaturasid'],')')",
"item/cr955_estadoasignatura": "@if(equals(items('Apply_to_each')?['tipo'],'Convalidacion'),904390001,if(equals(items('Apply_to_each')?['tipo'],'Pendiente'),904390004,904390000))",
"item/cr955_Matricula@odata.bind": "@concat('/cpmmr_matriculas(',outputs('Dataverse')?['body/cpmmr_matriculaid'],')')"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
},
"runAfter": {
"List_rows": [
"Succeeded"
]
}
}

5. Respuesta

{

&#x20; "type": "Response",

&#x20; "kind": "Http",

&#x20; "inputs": {

&#x20; "statusCode": 200,

&#x20; "headers": {

&#x20; "Content-Type": "application/json"

&#x20; },

&#x20; "body": {

&#x20; "rowId": "@{outputs('Dataverse')?\['body/cpmmr_matriculaid']}"

&#x20; }

&#x20; },

&#x20; "runAfter": {

&#x20; "Dataverse": \[

&#x20; "Succeeded"

&#x20; ]

&#x20; },

&#x20; "metadata": {

&#x20; "operationMetadataId": "d77c55f4-ba7c-4e22-a4d4-57ac2ebcd077"

&#x20; }

}

====================================================================================================================
Flow I — AdminSubirMatriculaEditada

Actualiza un registro existente de cpmmr_matriculas y sus asignaturas asociadas.

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"rowId": { "type": "string" },
"nombre": { "type": "string" },
"apellidos": { "type": "string" },
"dni": { "type": "string" },
"email": { "type": "string" },
"telefono": { "type": "string" },
"fechaNacimiento": { "type": "string" },
"domicilio": { "type": "string" },
"localidad": { "type": "string" },
"provincia": { "type": "string" },
"cp": { "type": "string" },
"ensenanzaCurso": { "type": "string" },
"especialidad": { "type": "string" },
"formaPago": { "type": "string" },
"reduccionTasas": { "type": "string" },
"autorizacionImagen": { "type": "boolean" },
"disponibilidadManana": { "type": "boolean" },
"horaSalida": { "type": "string" },
"asignaturasActualizadas": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "rowId": { "type": "string" },
      "estado": { "type": "integer" },
      "observaciones": { "type": "string" }
    }
  }
},
"asignaturasNuevas": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "codigo": { "type": "integer" },
      "nombre": { "type": "string" },
      "estado": { "type": "integer" }
    }
  }
}
},
"required": ["rowId"]
},
"method": "POST"
}
}

2. Condition (auth check x-api-key)

Si la clave es correcta, ejecutar los pasos 3, 4 y 5. Si no: Response 401.

3. Update a row — cpmmr_matriculas

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"recordId": "@triggerBody()?['rowId']",
"item/cpmmr_apellidos": "@triggerBody()?['apellidos']",
"item/cpmmr_autorizacionimagen": "@triggerBody()?['autorizacionImagen']",
"item/cpmmr_cp": "@triggerBody()?['cp']",
"item/cpmmr_disponibilidadmanana": "@triggerBody()?['disponibilidadManana']",
"item/cpmmr_dni": "@triggerBody()?['dni']",
"item/cpmmr_domicilio": "@triggerBody()?['domicilio']",
"item/cpmmr_email": "@triggerBody()?['email']",
"item/cpmmr_ensenanzaycurso": "@triggerBody()?['ensenanzaCurso']",
"item/cpmmr_especialidad": "@triggerBody()?['especialidad']",
"item/cpmmr_fechanacimiento": "@triggerBody()?['fechaNacimiento']",
"item/cpmmr_formadepago": "@triggerBody()?['formaPago']",
"item/cpmmr_horasalida": "@triggerBody()?['horaSalida']",
"item/cpmmr_localidad": "@triggerBody()?['localidad']",
"item/cpmmr_nombre": "@triggerBody()?['nombre']",
"item/cpmmr_provincia": "@triggerBody()?['provincia']",
"item/cpmmr_reducciontasas": "@triggerBody()?['reduccionTasas']",
"item/cpmmr_telefono": "@triggerBody()?['telefono']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "UpdateOnlyRecord"
}
}
}

4. Apply to each — asignaturasActualizadas

{
"type": "Foreach",
"foreach": "@triggerBody()?['asignaturasActualizadas']",
"actions": {
"Update_a_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"recordId": "@items('Apply_to_each_Actualizadas')?['rowId']",
"item/cr955_estadoasignatura": "@items('Apply_to_each_Actualizadas')?['estado']",
"item/cr955_observaciones": "@items('Apply_to_each_Actualizadas')?['observaciones']"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "UpdateOnlyRecord"
}
}
}
},
"runAfter": { "Update_a_row_matricula": ["Succeeded"] }
}

5. Apply to each — asignaturasNuevas

{
"type": "Foreach",
"foreach": "@triggerBody()?['asignaturasNuevas']",
"actions": {
"Add_a_new_row": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"item/cr955_name": "@items('Apply_to_each_Nuevas')?['nombre']",
"item/cr955_codigomateria": "@items('Apply_to_each_Nuevas')?['codigo']",
"item/cr955_estadoasignatura": "@items('Apply_to_each_Nuevas')?['estado']",
"item/cr955_Matricula@odata.bind": "@concat('/cpmmr_matriculas(', triggerBody()?['rowId'], ')')"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
}
}
},
"runAfter": { "Apply_to_each_Actualizadas": ["Succeeded"] }
}

6. Response

{
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": { "Content-Type": "application/json" },
"body": { "ok": true }
},
"runAfter": { "Apply_to_each_Nuevas": ["Succeeded"] }
}

====================================================================================================================
Flow J — AdminCrearAmpliacion

Crea un registro nuevo completo en cpmmr_matriculas (ampliación), sube el PDF y crea las asignaturas. Devuelve el rowId del nuevo registro.

1. Request (trigger)

{
"type": "Request",
"kind": "Http",
"inputs": {
"triggerAuthenticationType": "All",
"schema": {
"type": "object",
"properties": {
"nombre": { "type": "string" },
"apellidos": { "type": "string" },
"dni": { "type": "string" },
"email": { "type": "string" },
"telefono": { "type": "string" },
"fechaNacimiento": { "type": "string" },
"domicilio": { "type": "string" },
"localidad": { "type": "string" },
"provincia": { "type": "string" },
"cp": { "type": "string" },
"ensenanzaCurso": { "type": "string" },
"especialidad": { "type": "string" },
"formaPago": { "type": "string" },
"reduccionTasas": { "type": "string" },
"autorizacionImagen": { "type": "boolean" },
"disponibilidadManana": { "type": "boolean" },
"horaSalida": { "type": "string" },
"asignaturas": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "codigo": { "type": "integer" },
      "nombre": { "type": "string" },
      "estado": { "type": "integer" }
    }
  }
},
"pdfBase64": { "type": "string" }
},
"required": ["nombre", "apellidos", "dni", "email", "ensenanzaCurso"]
},
"method": "POST"
}
}

2. Condition (auth check x-api-key)

Si la clave es correcta, ejecutar los pasos 3, 4, 5 y 6. Si no: Response 401.

3. Add a new row — cpmmr_matriculas

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"item/cpmmr_nombre": "@triggerBody()?['nombre']",
"item/cpmmr_apellidos": "@triggerBody()?['apellidos']",
"item/cpmmr_dni": "@triggerBody()?['dni']",
"item/cpmmr_email": "@triggerBody()?['email']",
"item/cpmmr_telefono": "@triggerBody()?['telefono']",
"item/cpmmr_fechanacimiento": "@triggerBody()?['fechaNacimiento']",
"item/cpmmr_domicilio": "@triggerBody()?['domicilio']",
"item/cpmmr_localidad": "@triggerBody()?['localidad']",
"item/cpmmr_provincia": "@triggerBody()?['provincia']",
"item/cpmmr_cp": "@triggerBody()?['cp']",
"item/cpmmr_ensenanzaycurso": "@triggerBody()?['ensenanzaCurso']",
"item/cpmmr_especialidad": "@triggerBody()?['especialidad']",
"item/cpmmr_formadepago": "@triggerBody()?['formaPago']",
"item/cpmmr_reducciontasas": "@triggerBody()?['reduccionTasas']",
"item/cpmmr_autorizacionimagen": "@triggerBody()?['autorizacionImagen']",
"item/cpmmr_disponibilidadmanana": "@triggerBody()?['disponibilidadManana']",
"item/cpmmr_horasalida": "@triggerBody()?['horaSalida']",
"item/cpmmr_estado": 856530002
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
}
}

4. Condition: ¿pdfBase64 no está vacío?

Si @not(empty(triggerBody()?['pdfBase64'])):

4a. Upload a file or image — cpmmr_solicitudpdf

{
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cpmmr_matriculas",
"recordId": "@outputs('Add_a_new_row')?['body/cpmmr_matriculaid']",
"fileImageFieldName": "cpmmr_solicitudpdf",
"item/cpmmr_solicitudpdf": {
  "$content-type": "application/pdf",
  "$content": "@triggerBody()?['pdfBase64']"
}
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "UploadFileOrImage"
}
}
}

5. Apply to each — asignaturas

{
"type": "Foreach",
"foreach": "@triggerBody()?['asignaturas']",
"actions": {
"Add_a_new_row_asignatura": {
"type": "OpenApiConnection",
"inputs": {
"parameters": {
"entityName": "cr955_matriculaasignaturas",
"item/cr955_name": "@items('Apply_to_each_Asignaturas')?['nombre']",
"item/cr955_codigomateria": "@items('Apply_to_each_Asignaturas')?['codigo']",
"item/cr955_estadoasignatura": "@items('Apply_to_each_Asignaturas')?['estado']",
"item/cr955_Matricula@odata.bind": "@concat('/cpmmr_matriculas(', outputs('Add_a_new_row')?['body/cpmmr_matriculaid'], ')')"
},
"host": {
"apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
"connection": "shared_commondataserviceforapps",
"operationId": "CreateRecord"
}
}
}
}
}

6. Response

{
"type": "Response",
"kind": "Http",
"inputs": {
"statusCode": 200,
"headers": { "Content-Type": "application/json" },
"body": {
  "rowId": "@{outputs('Add_a_new_row')?['body/cpmmr_matriculaid']}"
}
},
"runAfter": { "Apply_to_each_Asignaturas": ["Succeeded"] }
}

====================================================================================================================
TABLAS================================================

Tabla: Matrícula Asignatura (cr955_matriculaasignatura)--------------------

Asignatura cr955_asignaturas busqueda (tabla cr955_asignaturas)

Código Materia cr955_CodigoMateria Número entero

Estado Asignatura cr955_EstadoAsignatura Opción

    904390000   Matriculada
    904390001   Solicitud de Convalidación
    904390002   Convalidada
    904390003   Simultaneada
    904390004   Pendiente

Matrícula cr955_Matricula Búsqueda (tabla cr955_matriculas)

Name cr955_Name Línea de texto única

NPrden cr955_NOrden Número entero

Observaciones cr955_Observaciones Area de texto

============================================================================

Tabla: Solicitudes de Matrículas (cpmmr_matricula)----------------

Nombre Tipo de datos

cpmmr_Apellidos Línea de texto única

cpmmr_Autorizacionlmagen Sí/No

cpmmr_CP Línea de texto única

cpmmr_DisponibilidadManana Sí/No

cpmmr_DNI Línea de texto única

cpmmr_DocFaltante Area de texto

cpmmr_Domicilio Línea de texto única

cpmmr_Email Correo electrónico

cpmmr_EnsenanzayCurso Línea de texto única

cpmmr_Especialidad Línea de texto única

cpmmr_Estado Opción

cpmmr_Fechadelnscripcion Solo fecha

cpmmr_FechaNacimiento Solo fecha

cpmmr_FormadePago Línea de texto única

cpmmr_HoraSalida Línea de texto unica

cpmmr_Localidad Línea de texto única

**cpmmr_Matriculald Identificador único**

cpmmr_Nombre Línea de texto única

cpmmr_NombreMatricula Linea de texto unica

cpmmr_Provincia Línea de texto única

cpmmr_ReduccionTasas Línea de texto única

cpmmr_solicitudPDF Archivo

cpmmr_Telefono Numero de telefono

cr955_convalidacionsolicitada Sí/No

cr955_docfaltante Línea de texto única

cr955_NOrden Número entero

====================================================================

Tabla: Asignatura (cr955_asignaturas)

MATERIA cr955_coursecode Número entero

ABREVIATURA cr955_courseabbreviation Línea de texto única

DESCRIPCION cr955_coursedescription Línea de texto única

CURSO_N cr955_courselevel Línea de texto única

ENSEÑANZAS cr955_educationtype Línea de texto única

ESPECIALIDAD cr955_specialization Línea de texto única

CURSO cr955_courseleveldescription Línea de texto única

Implementación de guardar las asignaturas

tienes todo lo relativo a la parte de dataverse (tablas y flujos) en @Power Apps y P Automate.md, tenlo en cuenta a partir de ahora. Tengo una tabla llamada Matrícula Asignaturas donde se deben guardar las asignaturas matriculadas con una relación de 1:N con la carpeta Solicitudes de matrículas, me debes indicar como debo modificar los flows (me imagineo que el folo afectado sería el JSON con todos los datos) para que también suba las asignaturas matriculadas en los campos cr955_CodigoMateria ( en número que identifique a la asignatura), cr955_EstadoAsignatura (Matriculada -valor: 904390000 -, Solicitud de convalidación-valor: 904390003 -, Convalidada-valor: 904390001 -, Simultaneada-valor: 904390002 -), cr955_Matricula con el id de matrícula, cr955_MatriculaAsignatura id único, cr955_Name el nombre de la asignatura que da en el pdf en el cuadro de "Asignaturas en las que se Matricula"), cr955_NOrden el nº de orden de la matrícula. Lo que se pretende es trasladar la sección del pdf "Asignaturas en las que se Matricula" a la tabla

=====================================================
URL

AdminListarSolicitudes

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/57ed354380e841a1b31fc0e674193ba7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tAMipMEMLpywHht-zemYJ5MjR7DPW8ZixYJf78Sl5WU

AdminObtenerPDF

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b47e37ea258945f0896c2e2f8e4f8122/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=dJeTsMOUZScHf6VkAIvZDo-v7q-PGI5z4khF5NYB5i8

AdminActualizarSolicitud

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/38c18f557dd943079d59593d2beeec3e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=1iYvXdDl5LXJnTnc9g_GIHRNyz0VzL141_E8NEvgiYc

AdminEditarSolicitud

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/21dae1f40ab5449b80378e4b40bb8f91/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=cJAhWDu0mCUEuJ1OVElCiTgPD-wk9Cn5oTl9wGzCZog

AdminBorrarSolicitud

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/57ed354380e841a1b31fc0e674193ba7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tAMipMEMLpywHht-zemYJ5MjR7DPW8ZixYJf78Sl5WU

AdminListarAsignaturasSolicitud

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cc23e567631349f68b045c64efe630ee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=vOTdVC7hYXBFPyhcgVzQAb9VHajBgCYIzy30deV4g4k

AdminCatalogoAsignaturas

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/98e5275a1b4b4f7995f1985b6601a11e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fjnl3ZoIwzT6RW1lu-35e8wiMmvNpt4jjyV63UKt_xw

AdminGuardarAsignaturas

https://c627b3c984dee98bb3d3cffe8c91c0.4d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e8e7f8c52b47417aa496c20e587bb98c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=iuIJ7gQv0RSkQ0xd56rvHwQ9nd6b_lkbNVtB8NVulAo

AdminSubirMatriculaEditada

(URL — rellenar tras crear el flow)

AdminCrearAmpliacion

(URL — rellenar tras crear el flow)
